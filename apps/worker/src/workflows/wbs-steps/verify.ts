import { NonRetryableError } from "cloudflare:workflows";
import type { ValidationReport } from "../../models/qc";
import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import * as bestPrompt from "../../prompts/step07_verify_best_judgment";
import * as strictPrompt from "../../prompts/step07_verify_strict";
import { putArtifactJson, putArtifactText } from "../../services/artifactsService";
import type { Logger } from "../../services/logger";
import { type VerifyOutput, verifyDocument } from "../../services/verifyService";
import { setStatus } from "../../status/statusClient";

export async function verifyStep(ctx: WbsWorkflowContext, env: Env, draftNodes: WbsNode[], validationReport: ValidationReport, regions: Region[], logger: Logger): Promise<VerifyOutput> {
    try {
        logger.info("verify - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, { step: "verify", percent: 75, message: "Verifying document" });

        const promptObj = ctx.job.mode === "strict" ? strictPrompt : bestPrompt;
        const userPrmopt = promptObj.buildUserPrompt({
            jobId: ctx.job.jobId,
            nodes: draftNodes,
            validationReport,
            regionsContent: regions.map(r => ({
                regionId: r.regionId,
                pageOrSheet: r.pageOrSheet,
                markdownContent: r.text,
            })),
        });

        await Promise.all([
            putArtifactText(ctx, env.UPLOADS_R2, `verifier_systemPrompt.txt`, promptObj.SYSTEM_PROMPT),
            putArtifactText(ctx, env.UPLOADS_R2, `verifier_userPrompt.txt`, userPrmopt)
        ]);

        const { out, rawText } = await verifyDocument(ctx, {
            systemPrompt: promptObj.SYSTEM_PROMPT,
            userPrompt: userPrmopt,
            llm: { provider: ctx.ai.verifyProvider, model: ctx.ai.verifyModel },
            metadata: {
                step: "verify",
                jobId: ctx.job.jobId,
            },
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
