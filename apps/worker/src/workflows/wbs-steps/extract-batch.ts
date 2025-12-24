import type { GlobalAnalysis } from "../../models/globalAnalysis";
import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { extractRegion } from "../../services/extractService";
import type { Logger } from "../../services/logger";
import { setStatus } from "../../status/statusClient";

export async function extractBatchStep(ctx: WbsWorkflowContext, env: Env, batch: Region[], batchStartIdx: number, regions: Region[], globalAnalysis: GlobalAnalysis, logger: Logger): Promise<WbsNode[]> {
    try {
        logger.info("extract-batch - starting", { index: batchStartIdx, length: batch.length });

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, {
            step: "extract_regions",
            percent: 30 + Math.floor((25 * (batchStartIdx + batch.length)) / regions.length),
            message: `Extracting regions ${batchStartIdx + 1}-${batchStartIdx + batch.length} of ${regions.length}`,
        });

        // Process batch in parallel
        const results = await Promise.all(
            batch.map(async (region) => {
                try {
                    // Get region-specific guidance from global analysis
                    const regionGuidance = globalAnalysis.regionGuidance.find(
                        g => g.regionId === region.regionId
                    );

                    logger.info("extract_region_start", {
                        regionId: region.regionId,
                        tokenEstimate: region.tokenEstimate,
                        provider: ctx.ai.extractProvider,
                        model: ctx.ai.extractModel,
                        hasGuidance: !!regionGuidance,
                        sectionPath: regionGuidance?.context.sectionPath
                    });

                    const { extraction, rawText } = await extractRegion(ctx, {
                        jobId: ctx.job.jobId,
                        mode: ctx.job.mode,
                        region: regionToSend,
                        llm: { provider: ctx.ai.extractProvider, model: ctx.ai.extractModel },
                        globalContext: {
                            analysis: globalAnalysis,
                            regionGuidance: regionGuidance?.context
                        },
                        metadata: {
                            step: "extract_batch",
                            index: batchStartIdx,
                            length: batch.length,
                            jobId: ctx.job.jobId,
                        }
                    });

                    await putArtifactJson(ctx, env.UPLOADS_R2, `extractions/region_${region.regionId}.json`, {
                        llm: {
                            provider: ctx.ai.extractProvider,
                            model: ctx.ai.extractModel,
                        },
                        extraction,
                        rawText,
                        contextUsed: regionGuidance?.context
                    });

                    logger.info("extract_region_done", {
                        regionId: region.regionId,
                        nodes: extraction.nodes.length,
                        confidence: extraction.confidence,
                    });

                    return extraction.nodes.map((n) => ({ ...n, jobId: ctx.job.jobId }) as WbsNode);
                } catch (err: any) {
                    logger.error("extract_region_error", {
                        regionId: region.regionId,
                        error: err.message,
                    });
                    logger.exception("extract_region_error", err);
                    throw err;
                }
            })
        );

        // Flatten results from all regions in this batch
        logger.info("extract-batch - done", { nodes: results.flat().length });

        return results.flat();
    }
    catch (error: any) {
        logger.exception("extract-batch - error", error);
        throw error;
    }
}
