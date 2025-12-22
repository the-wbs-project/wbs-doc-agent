import { NonRetryableError } from "cloudflare:workflows";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";

export async function storeFinalStep(ctx: WbsWorkflowContext, finalNodes: WbsNode[]) {
    try {
        ctx.logger.info("store-final - starting");

        await putArtifactJson(ctx, "document_final.json", finalNodes);

        ctx.logger.info("store-final - done");
    }
    catch (error) {
        ctx.logger.error("store-final - error", { error });
        throw new NonRetryableError("Failed to store final nodes");
    }
}