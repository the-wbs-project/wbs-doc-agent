import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { escalateAndJudge } from "../../services/escalateService";
import { getModel } from "../../services/llm/models";
import type { VerifyOutput } from "../../services/verifyService";
import { setStatus } from "../../status/statusClient";

export async function escalateStep(ctx: WbsWorkflowContext, regions: Region[], verifyOut: VerifyOutput): Promise<WbsNode[]> {
    try {
        ctx.logger.info("escalate - starting");

        await setStatus(ctx, {
            step: "escalate",
            percent: 82,
            message: "Escalation required; re-extracting targeted regions",
        });

        const targets = verifyOut.escalationPlan.targetRegionIds ?? [];

        ctx.logger.warn("escalation_needed", { targets, reason: verifyOut.escalationPlan.reason });

        const patches = await escalateAndJudge(ctx, {
            targetRegionIds: targets,
            regions,
            extractCandidates: [
                { name: "openai_candidate", provider: "openai", model: getModel("openai", 'small') },
                { name: "anthropic_candidate", provider: "anthropic", model: getModel("anthropic", 'small') },
                { name: "gemini_candidate", provider: "gemini", model: getModel("gemini", 'small') },
            ],
            judge: { provider: ctx.config.verifyProvider, model: ctx.config.verifyModel },
        });

        // Patch strategy: replace nodes for affected regions by provenance.regionId match
        const targetSet = new Set(targets);
        const result = verifyOut.correctedNodes.filter((n) => !targetSet.has(n.provenance?.regionId));

        for (const regionId of Object.keys(patches)) {
            result.push(...patches[regionId]);
            await putArtifactJson(ctx, `escalations/${regionId}/selected_patch.json`, patches[regionId]);
        }
        ctx.logger.info("escalate - done");

        return result;
    }
    catch (error: any) {
        ctx.logger.error("extract-batch - error", { error: { message: error.message, stack: error.stack } });
        throw error;
    }
}
