import { NonRetryableError } from "cloudflare:workflows";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import type { Logger } from "../../services/logger";
import type { Repositories } from "../../services/d1/repositories";
import { setStatus } from "../../status/statusClient";

export async function markRunning(ctx: WbsWorkflowContext, env: Env, logger: Logger, repos: Repositories) {
    try {
        console.log('hi again');
        logger.info("mark-running - starting");

        await repos.jobs.markRunning(ctx.job.jobId);

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { state: "running", step: "start", percent: 2, message: "Workflow started" });

        logger.info("mark-running - done");
    }
    catch (error: any) {
        logger.exception("mark-running - error", error);

        throw new NonRetryableError(error.message, error.stack);
    }
}