import { NonRetryableError } from "cloudflare:workflows";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { consolidate } from "../../services/consolidateService";
import type { Logger } from "../../services/logger";
import { setStatus } from "../../status/statusClient";

export async function consolidateStep(ctx: WbsWorkflowContext, env: Env, extractedNodes: WbsNode[], logger: Logger): Promise<WbsNode[]> {
    try {
        logger.info("consolidate - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "consolidate", percent: 65, message: "Consolidating nodes" });

        const draft = consolidate(extractedNodes, ctx.job.mode);

        await putArtifactJson(ctx, env.UPLOADS_R2, "document_draft.json", draft);

        logger.info("consolidate - done");
        return draft;
    }
    catch (error: any) {
        logger.error("consolidate - error", { message: error.message, stack: error.stack });
        throw new NonRetryableError(error.message, error.stack);
    }
}