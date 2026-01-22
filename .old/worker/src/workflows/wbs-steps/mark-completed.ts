import { NonRetryableError } from "cloudflare:workflows";
import type { ValidationReport } from "../../models/qc";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import type { Logger } from "../../services/logger";
import type { Repositories } from "../../services/d1/repositories";
import { setStatus } from "../../status/statusClient";

export async function markCompletedStep(ctx: WbsWorkflowContext, env: Env, finalNodes: WbsNode[], validationReport: ValidationReport, logger: Logger, repos: Repositories) {
    try {
        logger.info("mark-completed - starting");

        const inferredCount = finalNodes.filter((n) => !!n.inferred).length;

        await repos.jobs.markCompleted(ctx.job.jobId, {
            nodeCount: finalNodes.length,
            inferredCount,
            coverageRatio: validationReport.coverage.coverageRatio,
        } as any);

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { state: "completed", step: "done", percent: 100, message: "Completed" });

        logger.info("mark-completed - done");
        logger.info("workflow_completed", { nodes: finalNodes.length, inferredCount });
    }
    catch (error: any) {
        logger.exception("generate-summary - error", error);
        throw new NonRetryableError(error.message, error.stack);
    }
}