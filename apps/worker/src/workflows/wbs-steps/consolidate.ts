import { NonRetryableError } from "cloudflare:workflows";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { consolidate } from "../../services/consolidateService";
import { setStatus } from "../../status/statusClient";

export async function consolidateStep(ctx: WbsWorkflowContext, extractedNodes: WbsNode[]): Promise<WbsNode[]> {
    try {
        ctx.logger.info("consolidate - starting");

        await setStatus(ctx, { step: "consolidate", percent: 65, message: "Consolidating nodes" });

        const draft = consolidate(extractedNodes, ctx.job.mode);

        await putArtifactJson(ctx, "document_draft.json", draft);

        ctx.logger.info("consolidate - done");
        return draft;
    }
    catch (error) {
        ctx.logger.error("consolidate - error", { error });
        throw new NonRetryableError("Failed to consolidate nodes");
    }
}