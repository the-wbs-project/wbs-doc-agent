import type { JobMode } from "../models/job";
import type { Region } from "../models/regions";
import type { WbsNode } from "../models/wbs";
import * as bestPrompt from "../prompts/step04_extract_best_judgment";
import * as strictPrompt from "../prompts/step04_extract_strict";
import { uuid } from "./id";
import { generateJson } from "./llm/llmClient";

export type RegionExtraction = {
  regionId: string;
  confidence: number;
  notes: string;
  nodes: Array<Omit<WbsNode, "jobId">>;
  unmappedEvidence: Array<{ evidenceId: string; text: string; reason: string }>;
};

export async function extractRegion(env: Env, input: {
  jobId: string;
  mode: JobMode;
  region: Region;
  llm: { provider: "openai" | "anthropic" | "gemini"; model: string };
}) {
  const prompt = input.mode === "strict" ? strictPrompt : bestPrompt;

  const evidenceBundle = {
    pageOrSheet: input.region.pageOrSheet,
    regionId: input.region.regionId,
    type: input.region.type,
    text: input.region.text,
    evidenceRefs: input.region.evidenceRefs
  };

  const messages = [
    { role: "system" as const, content: prompt.SYSTEM_PROMPT },
    { role: "user" as const, content: prompt.buildUserPrompt({ jobId: input.jobId, mode: input.mode, region: input.region, evidenceBundle }) }
  ];

  const { json, rawText } = await generateJson<RegionExtraction>(env, {
    provider: input.llm.provider,
    model: input.llm.model,
    temperature: input.mode === "strict" ? 0.2 : 0.35,
    maxTokens: 60000
  }, messages);

  // Ensure IDs exist; if model forgot, assign
  for (const n of json.nodes) {
    if (!n.id) (n as any).id = uuid();
    if (!("metadata" in n) || !Array.isArray((n as any).metadata)) (n as any).metadata = [];
    if (!("warnings" in n) || !Array.isArray((n as any).warnings)) (n as any).warnings = [];
    if (!n.provenance) (n as any).provenance = { regionId: input.region.regionId, pageOrSheet: input.region.pageOrSheet, sourceType: "unknown", diRefs: {}, bbox: null, quote: "" };
  }

  return { extraction: json, rawText };
}
