import type { GlobalAnalysis, RegionContext } from "../models/globalAnalysis";
import type { JobMode } from "../models/job";
import type { Region } from "../models/regions";
import type { SiteConfig } from "../models/site-config";
import type { WbsNode } from "../models/wbs";
import { uuid } from "./id";
import { generateJson } from "./llm/llmClient";

export type RegionExtraction = {
  regionId: string;
  confidence: number;
  notes: string;
  nodes: Array<Omit<WbsNode, "jobId">>;
  unmappedContent: Array<{ text: string; reason: string }>;
};

export interface GlobalContext {
  analysis: GlobalAnalysis;
  regionGuidance?: RegionContext;
}

export async function extractRegion(config: SiteConfig, input: {
  mode: JobMode;
  region: Region;
  systemPrompt: string;
  userPrompt: string;
  metadata: Record<string, string | number>;
  llm: { provider: "openai" | "anthropic" | "gemini"; model: string };
}) {
  const messages = [
    { role: "system" as const, content: input.systemPrompt },
    { role: "user" as const, content: input.userPrompt }
  ];

  const { json, rawText } = await generateJson<RegionExtraction>(config, {
    provider: input.llm.provider,
    model: input.llm.model,
    temperature: input.mode === "strict" ? 0.1 : 0.35,
  }, messages, input.metadata);

  // Ensure IDs exist; if model forgot, assign
  for (const n of json.nodes) {
    if (!n.id) (n as any).id = uuid();
    if (!("metadata" in n) || !Array.isArray((n as any).metadata)) (n as any).metadata = [];
    if (!("warnings" in n) || !Array.isArray((n as any).warnings)) (n as any).warnings = [];
    if (!n.provenance) (n as any).provenance = { regionId: input.region.regionId, pageOrSheet: input.region.pageOrSheet, sourceType: "unknown", quote: "" };
  }

  return { extraction: json, rawText };
}
