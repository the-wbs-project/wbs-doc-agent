import type { Region } from "../models/regions";
import type { WbsNode } from "../models/wbs";
import type { WbsWorkflowContext } from "../models/wbs-workflow-context";
import * as judgePrompt from "../prompts/step08_judge_merge";
import { extractRegion } from "./extractService";
import { generateJson } from "./llm/llmClient";

export async function escalateAndJudge(ctx: WbsWorkflowContext, input: {
  targetRegionIds: string[];
  regions: Region[];
  extractCandidates: Array<{ name: string; provider: "openai" | "anthropic" | "gemini"; model: string }>;
  judge: { provider: "openai" | "anthropic" | "gemini"; model: string };
}) {
  const regionMap = new Map(input.regions.map(r => [r.regionId, r]));
  const patches: Record<string, WbsNode[]> = {};

  for (const regionId of input.targetRegionIds) {
    const region = regionMap.get(regionId);
    if (!region) continue;

    const candidates: Array<{ name: string; provider: string; model: string; nodes: WbsNode[]; rawNotes?: string }> = [];

    await Promise.all(input.extractCandidates.map(async c => {
      const { extraction } = await extractRegion(ctx, { jobId: ctx.job.jobId, mode: ctx.job.mode, region, llm: { provider: c.provider, model: c.model } });
      // attach jobId now
      const nodes = extraction.nodes.map(n => ({ ...n, jobId: ctx.job.jobId })) as WbsNode[];
      candidates.push({ name: c.name, provider: c.provider, model: c.model, nodes, rawNotes: extraction.notes });
    }));

    const messages = [
      { role: "system" as const, content: judgePrompt.SYSTEM_PROMPT },
      {
        role: "user" as const, content: judgePrompt.buildUserPrompt({
          jobId: ctx.job.jobId,
          mode: ctx.job.mode,
          region,
          evidenceText: region.text,
          evidenceRefs: region.evidenceRefs,
          candidates
        })
      }
    ];

    const { json } = await generateJson<any>(ctx, {
      provider: input.judge.provider,
      model: input.judge.model,
      temperature: 0.1,
    }, messages);

    patches[regionId] = (json.selected?.selectedNodes ?? []).map((n: any) => ({ ...n, jobId: ctx.job.jobId })) as WbsNode[];
  }

  return patches;
}
