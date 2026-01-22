import { NonRetryableError } from "cloudflare:workflows";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import type { Logger } from "../../services/logger";
import { setStatus } from "../../status/statusClient";

export async function diStatusUpdate(ctx: WbsWorkflowContext, env: Env, logger: Logger): Promise<void> {
    try {
        logger.info("di-status-update - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "di", percent: 8, message: "Checking DI cache" });

        logger.info("di-status-update - done");
    }
    catch (error: any) {
        logger.exception("di-status-update - error", error);

        throw new NonRetryableError(error.message, error.stack);
    }
}