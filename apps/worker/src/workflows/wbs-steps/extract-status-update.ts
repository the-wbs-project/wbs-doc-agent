import { NonRetryableError } from "cloudflare:workflows";
import type { Region } from "../../models/regions";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { setStatus } from "../../status/statusClient";

export async function extractStatusUpdateStep(ctx: WbsWorkflowContext, regions: Region[]): Promise<void> {
    try {
        ctx.logger.info("extract-status-update - starting");

        await setStatus(ctx, {
            step: "extract_regions",
            percent: 30,
            message: `Extracting ${regions.length} regions`,
        });

        ctx.logger.info("extract-status-update - done");
    }
    catch (error) {
        ctx.logger.error("extract-status-update - error", { error });

        throw new NonRetryableError("Failed to update extract status");
    }
}