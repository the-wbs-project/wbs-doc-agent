import type { Region } from "../models/regions";
import type { WbsNode } from "../models/wbs";
import type { WbsWorkflowContext } from "../models/wbs-workflow-context";
import * as judgePrompt from "../prompts/step08_judge_merge";
import { extractRegion } from "./extractService";
import { generateJson } from "./llm/llmClient";

export type EscalateCandidate = { name: string; provider: "openai" | "anthropic" | "gemini"; model: string };
export type EscalateJudge = { provider: "openai" | "anthropic" | "gemini"; model: string };
export type CandidateResult = { name: string; provider: string; model: string; nodes: WbsNode[]; rawNotes?: string };

/**
 * Step 1: Run parallel extractions from multiple candidates for a single region.
 */
export async function extractCandidatesForRegion(ctx: WbsWorkflowContext, input: {
  region: Region;
  metadata: Record<string, string | number>;
  extractCandidates: EscalateCandidate[];
}): Promise<CandidateResult[]> {
  const { region, extractCandidates } = input;

  const candidates: CandidateResult[] = [];

  await Promise.all(extractCandidates.map(async c => {
    const { extraction } = await extractRegion(ctx, { jobId: ctx.job.jobId, mode: ctx.job.mode, region, metadata: input.metadata, llm: { provider: c.provider, model: c.model } });
    const nodes = extraction.nodes.map(n => ({ ...n, jobId: ctx.job.jobId })) as WbsNode[];
    candidates.push({ name: c.name, provider: c.provider, model: c.model, nodes, rawNotes: extraction.notes });
  }));

  return candidates;
}

/**
 * Step 2: Judge the candidates and select the best nodes.
 */
export async function judgeCandidates(ctx: WbsWorkflowContext, input: {
  region: Region;
  candidates: CandidateResult[];
  judge: EscalateJudge;
  metadata: Record<string, string | number>;
}): Promise<WbsNode[]> {
  const { region, candidates, judge } = input;

  const messages = [
    { role: "system" as const, content: judgePrompt.SYSTEM_PROMPT },
    {
      role: "user" as const, content: judgePrompt.buildUserPrompt({
        jobId: ctx.job.jobId,
        mode: ctx.job.mode,
        region,
        candidates
      })
    }
  ];

  const { json } = await generateJson<any>(ctx, {
    provider: judge.provider,
    model: judge.model,
    temperature: 0.1,
  }, messages, input.metadata);

  return (json.selected?.selectedNodes ?? []).map((n: any) => ({ ...n, jobId: ctx.job.jobId })) as WbsNode[];
}
