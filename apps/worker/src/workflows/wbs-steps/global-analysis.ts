import type { GlobalAnalysis } from "../../models/globalAnalysis";
import type { Region } from "../../models/regions";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import type { NormalizedDi } from "../../services/diNormalizeService";
import { analyzeDocument } from "../../services/globalAnalysisService";
import type { Logger } from "../../services/logger";
import { appendStatus, setStatus } from "../../status/statusClient";

export async function globalAnalysisStep(ctx: WbsWorkflowContext, env: Env, diNormalized: NormalizedDi, regions: Region[], logger: Logger): Promise<GlobalAnalysis> {
    logger.info("global-analysis - starting");

    try {
        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "global_analysis", percent: 25, message: "Analyzing document structure" });

        const { analysis, rawText } = await analyzeDocument(ctx, {
            jobId: ctx.job.jobId,
            diNormalized,
            regions,
            llm: { provider: ctx.ai.globalProvider, model: ctx.ai.globalModel },
            metadata: {
                step: "global_analysis",
                jobId: ctx.job.jobId,
            },
        });

        await putArtifactJson(ctx, env.UPLOADS_R2, "global_analysis.json", { analysis, rawText });

        logger.info("global-analysis - done", {
            pattern: analysis.documentPattern,
            skeletonNodes: analysis.skeleton.nodes.length,
            regionsWithGuidance: analysis.regionGuidance.length
        });

        return analysis;
    }
    catch (error: any) {
        console.log(error);

        logger.exception("global-analysis - error", error);

        await appendStatus(ctx.job.jobId, env.JOB_STATUS_DO, "error", "Global analysis failed, trying again...");

        throw error;
    }
}