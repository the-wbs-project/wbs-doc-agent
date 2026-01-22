import type { Region } from "../../models/regions";
import type { WbsNode } from "../../models/wbs";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { putArtifactJson } from "../../services/artifactsService";
import { extractCandidatesForRegion, judgeCandidates, type EscalateCandidate, type EscalateJudge, type CandidateResult } from "../../services/escalateService";
import { getModel } from "../../services/llm/models";
import type { Logger } from "../../services/logger";
import type { VerifyOutput } from "../../services/verifyService";
import { setStatus } from "../../status/statusClient";

export interface EscalateConfig {
    extractCandidates: EscalateCandidate[];
    judge: EscalateJudge;
}

export function getEscalateConfig(ctx: WbsWorkflowContext): EscalateConfig {
    return {
        extractCandidates: [
            { name: "openai_candidate", provider: "openai", model: getModel("openai", 'large') },
            { name: "anthropic_candidate", provider: "anthropic", model: getModel("anthropic", 'small') },
            { name: "gemini_candidate", provider: "gemini", model: getModel("gemini", 'large') },
        ],
        judge: { provider: ctx.ai.verifyProvider, model: ctx.ai.verifyModel },
    };
}

export async function escalateStatusStep(ctx: WbsWorkflowContext, env: Env, verifyOut: VerifyOutput, logger: Logger): Promise<string[]> {
    try {

        const targets = verifyOut.escalationPlan.targetRegionIds ?? [];
        logger.info("escalate - starting", { targetCount: targets.length });

        await setStatus(ctx.job.jobId, env.JOB_STATUS_DO, {
            step: "escalate",
            percent: 82,
            message: `Escalation required; re-extracting ${targets.length} region(s)`,
        });

        logger.warn("escalation_needed", { targets, reason: verifyOut.escalationPlan.reason });
        return targets;
    } catch (error: any) {
        logger.exception("escalate_status - error", error);
        throw error;
    }
}

export async function escalateExtractStep(
    ctx: WbsWorkflowContext,
    region: Region,
    config: EscalateConfig,
    logger: Logger
): Promise<CandidateResult[]> {
    try {
        logger.info("escalate_extract - starting", { regionId: region.regionId });

        const candidates = await extractCandidatesForRegion(ctx, {
            region,
            metadata: {
                step: "escalate_extract",
                regionId: region.regionId,
                jobId: ctx.job.jobId,
            },
            extractCandidates: config.extractCandidates,
        });

        logger.info("escalate_extract - done", { regionId: region.regionId, candidateCount: candidates.length });
        return candidates;
    } catch (error: any) {
        logger.exception("escalate_extract - error", error);
        throw error;
    }
}

export async function escalateJudgeStep(
    ctx: WbsWorkflowContext,
    env: Env,
    region: Region,
    candidates: CandidateResult[],
    config: EscalateConfig,
    logger: Logger
): Promise<WbsNode[]> {
    try {
        logger.info("escalate_judge - starting", { regionId: region.regionId });

        const nodes = await judgeCandidates(ctx, {
            region,
            candidates,
            judge: config.judge,
            metadata: {
                step: "escalate_judge",
                jobId: ctx.job.jobId,
                regionId: region.regionId,
            }
        });

        await putArtifactJson(ctx, env.UPLOADS_R2, `escalations/${region.regionId}/selected_patch.json`, nodes);

        logger.info("escalate_judge - done", { regionId: region.regionId, nodeCount: nodes.length });
        return nodes;
    } catch (error: any) {
        logger.exception("escalate_judge - error", error);
        throw error;
    }
}

export function mergeEscalatedNodes(
    verifyOut: VerifyOutput,
    targetRegionIds: string[],
    patches: Record<string, WbsNode[]>
): WbsNode[] {
    const targetSet = new Set(targetRegionIds);
    const result = verifyOut.correctedNodes.filter((n) => !targetSet.has(n.provenance?.regionId));

    for (const regionId of Object.keys(patches)) {
        result.push(...patches[regionId]);
    }

    // Dedupe by node id (keep last occurrence)
    const seen = new Map<string, WbsNode>();
    for (const node of result) {
        seen.set(node.id, node);
    }
    return Array.from(seen.values());
}
