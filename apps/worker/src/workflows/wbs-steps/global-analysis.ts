import type { GlobalAnalysis } from "../../models/globalAnalysis";
import type { Region } from "../../models/regions";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import * as prompt from "../../prompts/step03b_global_analysis";
import { putArtifactJson, putArtifactText } from "../../services/artifactsService";
import type { NormalizedDi } from "../../services/diNormalizeService";
import { analyzeDocument, buildFullDocumentContent } from "../../services/globalAnalysisService";
import type { Logger } from "../../services/logger";
import { appendStatus, setStatus } from "../../status/statusClient";

export async function globalAnalysisStep(ctx: WbsWorkflowContext, env: Env, diNormalized: NormalizedDi, regions: Region[], logger: Logger): Promise<GlobalAnalysis> {
    logger.info("global-analysis - starting");

    try {
        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "global_analysis", percent: 25, message: "Analyzing document structure" });

        const systemPrompt = prompt.SYSTEM_PROMPT;
        const userPrompt = prompt.buildUserPrompt({
            jobId: ctx.job.jobId,
            fullContent: buildFullDocumentContent(diNormalized, regions),
            regions,
            pageCount: diNormalized.pages.length || 1,
            userContext: ctx.job.options?.userContext as string | undefined
        });

        await Promise.all([
            putArtifactText(ctx, env.UPLOADS_R2, "global_analysis_systemPrompt.txt", systemPrompt),
            putArtifactText(ctx, env.UPLOADS_R2, "global_analysis_userPrompt.txt", userPrompt)
        ]);

        const { analysis, rawText } = await analyzeDocument(ctx, {
            systemPrompt,
            userPrompt,
            regions,
            llm: { provider: ctx.ai.globalProvider, model: ctx.ai.globalModel },
            metadata: {
                step: "global_analysis",
                jobId: ctx.job.jobId,
            },
        });

        await putArtifactJson(ctx, env.UPLOADS_R2, "global_analysis_output.json", { analysis, rawText });

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