import type { ValidationReport } from "../../models/qc";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import type { Logger } from "../../services/logger";
import { generateSummary } from "../../services/summaryService";
import type { VerifierIssue } from "../../services/verifyService";
import { setStatus } from "../../status/statusClient";

export async function generateSummaryStep(ctx: WbsWorkflowContext, env: Env, finalNodes: WbsNode[], validationReport: ValidationReport, verifierIssues: VerifierIssue[], logger: Logger) {
    try {
        logger.info("generate-summary - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "summary", percent: 96, message: "Generating summary" });

        const { summary, rawText } = await generateSummary(ctx, {
            nodes: finalNodes,
            validationReport,
            verifierIssues,
            llm: { provider: ctx.ai.summaryProvider, model: ctx.ai.summaryModel },
            metadata: {
                step: "generate_summary",
                jobId: ctx.job.jobId,
            },
        });

        await putArtifactJson(ctx, env.UPLOADS_R2, "summary.json", { summary, summaryRaw: rawText });

        logger.info("generate-summary - done");
    }
    catch (error: any) {
        logger.exception("generate-summary - error", error);

        throw error;
    }
}