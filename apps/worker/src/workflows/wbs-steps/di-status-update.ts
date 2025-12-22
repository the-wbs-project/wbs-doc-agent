import { NonRetryableError } from "cloudflare:workflows";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { setStatus } from "../../status/statusClient";

export async function diStatusUpdate(ctx: WbsWorkflowContext) {
    try {
        ctx.logger.info("di-status-update - starting");

        await setStatus(ctx, { step: "di", percent: 8, message: "Checking DI cache" });

        ctx.logger.info("di-status-update - done");
    }
    catch (error) {
        ctx.logger.error("di-status-update - error", { error });

        throw new NonRetryableError("Failed to update DI status");
    }
}