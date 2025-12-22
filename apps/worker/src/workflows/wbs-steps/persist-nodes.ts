import { NonRetryableError } from "cloudflare:workflows";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import type { Logger } from "../../services/logger";
import type { Repositories } from "../../services/mongo/repositories";
import { setStatus } from "../../status/statusClient";

export async function persistNodesStep(ctx: WbsWorkflowContext, env: Env, finalNodes: WbsNode[], logger: Logger, repos: Repositories) {
    try {
        logger.info("persist-nodes - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "persist", percent: 92, message: "Persisting nodes to MongoDB" });

        await repos.nodes.replaceForJob(ctx.job.jobId, finalNodes);

        logger.info("persist-nodes - done");
    }
    catch (error: any) {
        logger.exception("persist-nodes - error", error);
        throw new NonRetryableError(error.message, error.stack);
    }
}