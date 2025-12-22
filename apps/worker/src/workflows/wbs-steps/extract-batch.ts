import type { GlobalAnalysis } from "../../models/globalAnalysis";
import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { extractRegion } from "../../services/extractService";
import { setStatus } from "../../status/statusClient";

export async function extractBatchStep(ctx: WbsWorkflowContext, batch: Region[], batchStartIdx: number, regions: Region[], globalAnalysis: GlobalAnalysis): Promise<WbsNode[]> {
    try {
        ctx.logger.info("extract-batch - starting", { index: batchStartIdx, length: batch.length });

        await setStatus(ctx, {
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

                    ctx.logger.info("extract_region_start", {
                        regionId: region.regionId,
                        type: region.type,
                        tokenEstimate: region.tokenEstimate,
                        provider: ctx.config.extractProvider,
                        model: ctx.config.extractModel,
                        hasGuidance: !!regionGuidance,
                        sectionPath: regionGuidance?.context.sectionPath
                    });

                    const { extraction, rawText } = await extractRegion(ctx.env, {
                        jobId: ctx.job.jobId,
                        mode: ctx.job.mode,
                        region,
                        llm: { provider: ctx.config.extractProvider, model: ctx.config.extractModel },
                        globalContext: {
                            documentPattern: globalAnalysis.documentPattern,
                            regionGuidance: regionGuidance?.context
                        }
                    });

                    await putArtifactJson(ctx, `extractions/region_${region.regionId}.json`, {
                        extraction,
                        rawText,
                        contextUsed: regionGuidance?.context
                    });

                    ctx.logger.info("extract_region_done", {
                        regionId: region.regionId,
                        nodes: extraction.nodes.length,
                        confidence: extraction.confidence,
                    });

                    return extraction.nodes.map((n) => ({ ...n, jobId: ctx.job.jobId }) as WbsNode);
                } catch (err: any) {
                    ctx.logger.error("extract_region_error", {
                        regionId: region.regionId,
                        error: err.message,
                    });
                    throw err;
                }
            })
        );

        // Flatten results from all regions in this batch
        ctx.logger.info("extract-batch - done", { nodes: results.flat().length });

        return results.flat();
    }
    catch (error: any) {
        ctx.logger.error("extract-batch - error", { error: { message: error.message, stack: error.stack } });
        throw error;
    }
}
