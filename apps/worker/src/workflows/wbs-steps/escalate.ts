import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { escalateAndJudge } from "../../services/escalateService";
import { getModel } from "../../services/llm/models";
import type { Logger } from "../../services/logger";
import type { VerifyOutput } from "../../services/verifyService";
import { setStatus } from "../../status/statusClient";

export async function escalateStep(ctx: WbsWorkflowContext, env: Env, regions: Region[], verifyOut: VerifyOutput, logger: Logger): Promise<WbsNode[]> {
    try {
        logger.info("escalate - starting");

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, {
            step: "escalate",
            percent: 82,
            message: "Escalation required; re-extracting targeted regions",
        });

        const targets = verifyOut.escalationPlan.targetRegionIds ?? [];

        logger.warn("escalation_needed", { targets, reason: verifyOut.escalationPlan.reason });

        const patches = await escalateAndJudge(ctx, {
            targetRegionIds: targets,
            regions,
            extractCandidates: [
                { name: "openai_candidate", provider: "openai", model: getModel("openai", 'small') },
                { name: "anthropic_candidate", provider: "anthropic", model: getModel("anthropic", 'small') },
                { name: "gemini_candidate", provider: "gemini", model: getModel("gemini", 'small') },
            ],
            judge: { provider: ctx.ai.verifyProvider, model: ctx.ai.verifyModel },
        });

        // Patch strategy: replace nodes for affected regions by provenance.regionId match
        const targetSet = new Set(targets);
        const result = verifyOut.correctedNodes.filter((n) => !targetSet.has(n.provenance?.regionId));

        for (const regionId of Object.keys(patches)) {
            result.push(...patches[regionId]);
            await putArtifactJson(ctx, env.UPLOADS_R2, `escalations/${regionId}/selected_patch.json`, patches[regionId]);
        }
        logger.info("escalate - done");

        return result;
    }
    catch (error: any) {
        logger.exception("escalate - error", error);
        throw error;
    }
}
