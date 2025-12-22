import { NonRetryableError } from "cloudflare:workflows";
import type { Region } from "../../models/regions";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import type { Logger } from "../../services/logger";
import { setStatus } from "../../status/statusClient";

export async function extractStatusUpdateStep(ctx: WbsWorkflowContext, env: Env, regions: Region[], logger: Logger): Promise<void> {
    try {
        logger.info("extract-status-update - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, {
            step: "extract_regions",
            percent: 30,
            message: `Extracting ${regions.length} regions`,
        });

        logger.info("extract-status-update - done");
    }
    catch (error: any) {
        logger.exception("extract-status-update - error", error);

        throw new NonRetryableError(error.message, error.stack);
    }
}