import { NonRetryableError } from "cloudflare:workflows";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { analyzeWithDiBackend } from "../../services/azureDiService";
import { kvGetJson } from "../../services/kvCacheService";
import { getR2Object } from "../../services/r2Service";
import { appendStatus } from "../../status/statusClient";

export async function diCheckCacheAndCall(ctx: WbsWorkflowContext): Promise<{ diRaw: any, cacheHit: boolean }> {
    try {
        ctx.logger.info("di-check-cache-and-call - starting");
        let diRaw: any = null;
        let cacheHit = false;

        if (ctx.config.diCacheEnabled) {
            diRaw = await kvGetJson(ctx.env, ctx.config.diCacheKey);
            cacheHit = !!diRaw;
            ctx.logger.info("di_cache_check", { cacheKey: ctx.config.diCacheKey, cacheHit });
        }

        if (!diRaw) {
            await appendStatus(ctx, "info", "DI cache miss; fetching file from R2");

            const fileObj = await getR2Object(ctx.env, ctx.job.r2UploadKey);

            ctx.logger.info("r2_file_fetched", { key: ctx.job.r2UploadKey });

            await appendStatus(ctx, "info", "Calling DI backend");

            const t0 = Date.now();
            diRaw = await analyzeWithDiBackend(ctx.env, {
                fileObj,
                fileKey: ctx.job.r2UploadKey,
            });
            ctx.logger.info("di_backend_done", { ms: Date.now() - t0 });
        }

        ctx.logger.info("di-check-cache-and-call - done");

        return { diRaw, cacheHit };
    }
    catch (error) {
        ctx.logger.error("di-check-cache-and-call - error", { error });
        throw new NonRetryableError("Failed to check cache and call DI backend");
    }
}