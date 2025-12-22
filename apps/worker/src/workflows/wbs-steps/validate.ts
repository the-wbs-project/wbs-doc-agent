import { NonRetryableError } from "cloudflare:workflows";
import type { ValidationReport } from "../../models/qc";
import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import type { Logger } from "../../services/logger";
import { validateNodes } from "../../services/validateService";
import { setStatus } from "../../status/statusClient";

export async function validateStep(ctx: WbsWorkflowContext, env: Env, extractedNodes: WbsNode[], regions: Region[], logger: Logger): Promise<ValidationReport> {
    try {
        logger.info("validate - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "validate", percent: 60, message: "Validating and generating QC report" });

        const report = validateNodes(extractedNodes, regions);

        await putArtifactJson(ctx, env.UPLOADS_R2, "validation_report.json", report);

        logger.info("validate - done");

        return report;
    }
    catch (error: any) {
        logger.exception("validate - error", error);

        throw new NonRetryableError(error.message, error.stack);
    }
}