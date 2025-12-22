import { NonRetryableError } from "cloudflare:workflows";
import type { Region } from "../../models/regions";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { type NormalizedDi, normalizeDi } from "../../services/diNormalizeService";
import type { Logger } from "../../services/logger";
import { segmentDi } from "../../services/segmentService";
import { setStatus } from "../../status/statusClient";

export async function normalizeSegment(ctx: WbsWorkflowContext, env: Env, diRaw: unknown, logger: Logger): Promise<{ diNormalized: NormalizedDi, regions: Region[] }> {
    try {
        logger.info("normalize-segment - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "segment", percent: 20, message: "Normalizing and segmenting DI output" });

        const diNormalized = normalizeDi(diRaw);
        const regions = segmentDi(diNormalized);

        await Promise.all([
            putArtifactJson(ctx, env.UPLOADS_R2, "di_normalized.json", diNormalized),
            putArtifactJson(ctx, env.UPLOADS_R2, "regions.json", regions)
        ]);

        logger.info("normalize-segment - done");

        return { diNormalized, regions };
    }
    catch (error: any) {
        logger.exception("normalize-segment - error", error);

        throw new NonRetryableError(error.message, error.stack);
    }
}