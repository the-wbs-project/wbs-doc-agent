import { NonRetryableError } from "cloudflare:workflows";
import type { ValidationReport } from "../../models/qc";
import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import type { Logger } from "../../services/logger";
import { type VerifyOutput, verifyDocument } from "../../services/verifyService";
import { setStatus } from "../../status/statusClient";

export async function verifyStep(ctx: WbsWorkflowContext, env: Env, draftNodes: WbsNode[], validationReport: ValidationReport, regions: Region[], logger: Logger): Promise<VerifyOutput> {
    try {
        logger.info("verify - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "verify", percent: 75, message: "Verifying document" });

        const { out, rawText } = await verifyDocument(ctx, {
            jobId: ctx.job.jobId,
            mode: ctx.job.mode,
            nodes: draftNodes,
            validationReport,
            regions,
            llm: { provider: ctx.ai.verifyProvider, model: ctx.ai.verifyModel },
        });

        await putArtifactJson(ctx, env.UPLOADS_R2, "verifier_output.json", { verifyOut: out, verifyRaw: rawText });

        logger.info("verify - done");

        return out;
    }
    catch (error: any) {
        logger.exception("verify - error", error);

        throw new NonRetryableError(error.message, error.stack);
    }
};
