import { NonRetryableError } from "cloudflare:workflows";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { setStatus } from "../../status/statusClient";

export async function persistNodesStep(ctx: WbsWorkflowContext, finalNodes: WbsNode[]) {
    try {
        ctx.logger.info("persist-nodes - starting");

        await setStatus(ctx, { step: "persist", percent: 92, message: "Persisting nodes to MongoDB" });

        await ctx.repos.nodes.replaceForJob(ctx.jobId, finalNodes);

        ctx.logger.info("persist-nodes - done");
    }
    catch (error) {
        ctx.logger.error("persist-nodes - error", { error });
        throw new NonRetryableError("Failed to persist nodes");
    }
}