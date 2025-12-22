import { NonRetryableError } from "cloudflare:workflows";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { setStatus } from "../../status/statusClient";

export async function markRunning(ctx: WbsWorkflowContext) {
    try {
        ctx.logger.info("mark-running - starting");

        await ctx.repos.jobs.markRunning(ctx.jobId);

        await setStatus(ctx, { state: "running", step: "start", percent: 2, message: "Workflow started" });

        ctx.logger.info("mark-running - done");
    }
    catch (error) {
        ctx.logger.error("mark-running - error", { error });

        throw new NonRetryableError("Failed to mark job as running");
    }
}