import { NonRetryableError } from "cloudflare:workflows";
import type { ValidationReport } from "../../models/qc";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { generateSummary } from "../../services/summaryService";
import type { VerifierIssue } from "../../services/verifyService";
import { setStatus } from "../../status/statusClient";

export async function generateSummaryStep(ctx: WbsWorkflowContext, finalNodes: WbsNode[], validationReport: ValidationReport, verifierIssues: VerifierIssue[]) {
    try {
        ctx.logger.info("generate-summary - starting");

        await setStatus(ctx, { step: "summary", percent: 96, message: "Generating summary" });

        const { summary, rawText } = await generateSummary(ctx, {
            nodes: finalNodes,
            validationReport,
            verifierIssues,
            llm: { provider: ctx.config.summaryProvider, model: ctx.config.summaryModel },
        });

        await putArtifactJson(ctx, "summary.json", { summary, summaryRaw: rawText });

        ctx.logger.info("generate-summary - done");
    }
    catch (error) {
        ctx.logger.error("generate-summary - error", { error });
        throw new NonRetryableError("Failed to generate summary");
    }
}