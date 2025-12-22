import { NonRetryableError } from "cloudflare:workflows";
import { putArtifactJson } from "../../services/artifactsService";
import { cacheTtl, kvPutJson } from "../../services/kvCacheService";
import type { Repositories } from "../../services/mongo/repositories";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";

export async function diStoreArtifact(ctx: WbsWorkflowContext, diRaw: unknown, cacheHit: boolean, repos: Repositories): Promise<void> {
    try {
        ctx.logger.info("di-store-artifact - starting");

        if (cacheHit) {
            await putArtifactJson(ctx, "di_cached.json", diRaw);
            await repos.artifacts.record(ctx.job.jobId, "di_cached", `artifacts/${ctx.job.jobId}/di_cached.json`);

        } else {
            await putArtifactJson(ctx, "di_raw.json", diRaw);
            await repos.artifacts.record(ctx.job.jobId, "di_raw", `artifacts/${ctx.job.jobId}/di_raw.json`);

            if (ctx.config.diCacheEnabled) {
                await kvPutJson(ctx.env, ctx.config.diCacheKey, diRaw, cacheTtl(ctx.env));
            }
        }
        ctx.logger.info("di-store-artifact - done");
    }
    catch (error) {
        ctx.logger.error("di-store-artifact - error", { error });
        throw new NonRetryableError("Failed to store DI artifact");
    }
}