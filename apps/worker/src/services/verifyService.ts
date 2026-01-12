import type { SiteConfig } from "../models/site-config";
import type { WbsNode } from "../models/wbs";
import { generateJson } from "./llm/llmClient";

export type VerifierIssue = { severity: "info" | "warn" | "error"; nodeId: string | null; message: string; regionId: string | null };
export type VerifyOutput = {
  correctedNodes: WbsNode[];
  issues: VerifierIssue[];
  escalationPlan: { needed: boolean; targetRegionIds: string[]; reason: string };
};

export async function verifyDocument(config: SiteConfig, input: {
  systemPrompt: string;
  userPrompt: string;
  metadata: Record<string, string | number>;
  llm: { provider: "openai" | "anthropic" | "gemini"; model: string };
}) {
  const messages = [
    { role: "system" as const, content: input.systemPrompt },
    { role: "user" as const, content: input.userPrompt }
  ];

  const { json, rawText } = await generateJson<VerifyOutput>(config, {
    provider: input.llm.provider,
    model: input.llm.model,
    temperature: 0.1,
  }, messages, input.metadata);

  return { out: json, rawText };
}
