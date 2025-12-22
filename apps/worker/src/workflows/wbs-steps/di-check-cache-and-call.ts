import { NonRetryableError } from "cloudflare:workflows";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { analyzeWithDiBackend } from "../../services/azureDiService";
import { kvGetJson } from "../../services/kvCacheService";
import type { Logger } from "../../services/logger";
import { getR2Object } from "../../services/r2Service";
import { appendStatus } from "../../status/statusClient";

export async function diCheckCacheAndCall(ctx: WbsWorkflowContext, env: Env, logger: Logger): Promise<{ diRaw: any, cacheHit: boolean }> {
    try {
        logger.info("di-check-cache-and-call - starting");
        let diRaw: any = null;
        let cacheHit = false;

        if (ctx.docIntel.cacheEnabled) {
            diRaw = await kvGetJson(env.DI_CACHE_KV, ctx.docIntel.cacheKey);
            cacheHit = !!diRaw;
            logger.info("di_cache_check", { cacheKey: ctx.docIntel.cacheKey, cacheHit });
        }

        if (!diRaw) {
            await appendStatus(ctx.job.jobId, env.JOB_STATUS_DO, "info", "DI cache miss; fetching file from R2");

            const fileObj = await getR2Object(env.UPLOADS_R2, ctx.job.r2UploadKey);

            logger.info("r2_file_fetched", { key: ctx.job.r2UploadKey });

            await appendStatus(ctx.job.jobId, env.JOB_STATUS_DO, "info", "Calling DI backend");

            const t0 = Date.now();
            diRaw = await analyzeWithDiBackend(ctx, {
                fileObj,
                fileKey: ctx.job.r2UploadKey,
            });
            logger.info("di_backend_done", { ms: Date.now() - t0 });
        }

        logger.info("di-check-cache-and-call - done");

        return { diRaw, cacheHit };
    }
    catch (error: any) {
        logger.exception("di-check-cache-and-call - error", error);
        throw new NonRetryableError(error.message, error.stack);
    }
}