import { NonRetryableError } from "cloudflare:workflows";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import type { Logger } from "../../services/logger";

export async function storeFinalStep(ctx: WbsWorkflowContext, env: Env, finalNodes: WbsNode[], logger: Logger) {
    try {
        logger.info("store-final - starting");

        await putArtifactJson(ctx, env.UPLOADS_R2, "document_final.json", finalNodes);

        logger.info("store-final - done");
    }
    catch (error: any) {
        logger.exception("store-final - error", error);

        throw new NonRetryableError(error.message, error.stack);
    }
}