import { NonRetryableError } from "cloudflare:workflows";
import type { ValidationReport } from "../../models/qc";
import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { type VerifyOutput, verifyDocument } from "../../services/verifyService";
import { setStatus } from "../../status/statusClient";

export async function verifyStep(ctx: WbsWorkflowContext, draftNodes: WbsNode[], validationReport: ValidationReport, regions: Region[]): Promise<VerifyOutput> {
    try {
        ctx.logger.info("verify - starting");

        await setStatus(ctx, { step: "verify", percent: 75, message: "Verifying document" });

        const { out, rawText } = await verifyDocument(ctx.env, {
            jobId: ctx.job.jobId,
            mode: ctx.job.mode,
            nodes: draftNodes,
            validationReport,
            regions,
            llm: { provider: ctx.config.verifyProvider, model: ctx.config.verifyModel },
        });

        await putArtifactJson(ctx, "verifier_output.json", { verifyOut: out, verifyRaw: rawText });

        ctx.logger.info("verify - done");

        return out;
    }
    catch (error: any) {
        ctx.logger.error("verify - error", { error: { message: error.message, stack: error.stack } });

        throw new NonRetryableError("Failed to verify document");
    }
};
