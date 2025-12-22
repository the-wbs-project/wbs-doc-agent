import { NonRetryableError } from "cloudflare:workflows";
import type { ValidationReport } from "../../models/qc";
import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { validateNodes } from "../../services/validateService";
import { setStatus } from "../../status/statusClient";

export async function validateStep(ctx: WbsWorkflowContext, extractedNodes: WbsNode[], regions: Region[]): Promise<ValidationReport> {
    try {
        ctx.logger.info("validate - starting");

        await setStatus(ctx, { step: "validate", percent: 60, message: "Validating and generating QC report" });

        const report = validateNodes(ctx.job.jobId, extractedNodes, regions);

        await putArtifactJson(ctx, "validation_report.json", report);

        ctx.logger.info("validate - done");

        return report;
    }
    catch (error) {
        ctx.logger.error("validate - error", { error });
        throw new NonRetryableError("Failed to validate nodes");
    }
}