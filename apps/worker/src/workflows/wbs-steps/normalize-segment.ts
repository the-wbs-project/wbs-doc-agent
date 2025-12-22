import { NonRetryableError } from "cloudflare:workflows";
import type { Region } from "../../models/regions";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { type NormalizedDi, normalizeDi } from "../../services/diNormalizeService";
import { segmentDi } from "../../services/segmentService";
import { setStatus } from "../../status/statusClient";

export async function normalizeSegment(ctx: WbsWorkflowContext, diRaw: unknown): Promise<{ diNormalized: NormalizedDi, regions: Region[] }> {
    try {
        ctx.logger.info("normalize-segment - starting");

        await setStatus(ctx, { step: "segment", percent: 20, message: "Normalizing and segmenting DI output" });

        const diNormalized = normalizeDi(diRaw);
        const regions = segmentDi(diNormalized);

        await Promise.all([
            putArtifactJson(ctx, "di_normalized.json", diNormalized),
            putArtifactJson(ctx, "regions.json", regions)
        ]);

        ctx.logger.info("normalize-segment - done");

        return { diNormalized, regions };
    }
    catch (error) {
        ctx.logger.error("normalize-segment - error", { error });

        throw new NonRetryableError("Failed to normalize and segment DI output");
    }
}