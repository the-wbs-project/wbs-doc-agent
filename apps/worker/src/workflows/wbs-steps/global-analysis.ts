import type { GlobalAnalysis } from "../../models/globalAnalysis";
import type { Region } from "../../models/regions";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import type { NormalizedDi } from "../../services/diNormalizeService";
import { analyzeDocument } from "../../services/globalAnalysisService";
import type { Logger } from "../../services/logger";
import { appendStatus, setStatus } from "../../status/statusClient";

export async function globalAnalysisStep(ctx: WbsWorkflowContext, diNormalized: NormalizedDi, regions: Region[], log: Logger): Promise<GlobalAnalysis> {
    log.info("global-analysis - starting step");

    try {
        await setStatus(ctx, { step: "global_analysis", percent: 25, message: "Analyzing document structure" });

        const { analysis, rawText } = await analyzeDocument(ctx.env, {
            jobId: ctx.job.jobId,
            diNormalized,
            regions,
            llm: { provider: ctx.config.globalProvider, model: ctx.config.globalModel }
        });

        await putArtifactJson(ctx, "global_analysis.json", { analysis, rawText });

        log.info("global-analysis - done", {
            pattern: analysis.documentPattern,
            skeletonNodes: analysis.skeleton.nodes.length,
            regionsWithGuidance: analysis.regionGuidance.length
        });

        return analysis;
    }
    catch (error: any) {
        console.log(error);

        ctx.logger.error("global-analysis - error", { error: { message: error.message, stack: error.stack } });

        await appendStatus(ctx, "error", "Global analysis failed, trying again...");

        throw error;
    }
}