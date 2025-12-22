import { NonRetryableError } from "cloudflare:workflows";
import type { ValidationReport } from "../../models/qc";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import type { VerifierIssue } from "../../services/verifyService";
import { setStatus } from "../../status/statusClient";

export async function markCompletedStep(ctx: WbsWorkflowContext, finalNodes: WbsNode[], validationReport: ValidationReport, verifierIssues: VerifierIssue[]) {
    try {
        ctx.logger.info("mark-completed - starting");

        const inferredCount = finalNodes.filter((n) => !!n.inferred).length;

        await ctx.repos.jobs.markCompleted(ctx.jobId, {
            nodeCount: finalNodes.length,
            inferredCount,
            coverageRatio: validationReport.coverage.coverageRatio,
        } as any);

        await setStatus(ctx, { state: "completed", step: "done", percent: 100, message: "Completed" });

        ctx.logger.info("mark-completed - done");
        ctx.logger.info("workflow_completed", { nodes: finalNodes.length, inferredCount });
    }
    catch (error) {
        ctx.logger.error("generate-summary - error", { error });
        throw new NonRetryableError("Failed to generate summary");
    }
}