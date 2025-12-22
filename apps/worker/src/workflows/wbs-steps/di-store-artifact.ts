import { NonRetryableError } from "cloudflare:workflows";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { kvPutJson } from "../../services/kvCacheService";
import type { Logger } from "../../services/logger";
import type { Repositories } from "../../services/mongo/repositories";

export async function diStoreArtifact(ctx: WbsWorkflowContext, env: Env, diRaw: unknown, cacheHit: boolean, repos: Repositories, logger: Logger): Promise<void> {
    try {
        logger.info("di-store-artifact - starting");

        if (cacheHit) {
            await putArtifactJson(ctx, env.UPLOADS_R2, "di_cached.json", diRaw);
            await repos.artifacts.record(ctx.job.jobId, "di_cached", `artifacts/${ctx.job.jobId}/di_cached.json`);

        } else {
            await putArtifactJson(ctx, env.UPLOADS_R2, "di_raw.json", diRaw);
            await repos.artifacts.record(ctx.job.jobId, "di_raw", `artifacts/${ctx.job.jobId}/di_raw.json`);

            if (ctx.docIntel.cacheEnabled) {
                await kvPutJson(env.DI_CACHE_KV, ctx.docIntel.cacheKey, diRaw, ctx.docIntel.cacheTtlSeconds);
            }
        }
        logger.info("di-store-artifact - done");
    }
    catch (error: any) {
        logger.exception("di-store-artifact - error", error);
        throw new NonRetryableError(error.message, error.stack);
    }
}