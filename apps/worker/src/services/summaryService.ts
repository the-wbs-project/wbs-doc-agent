import type { JobMode } from "../models/job";
import type { ValidationReport } from "../models/qc";
import type { WbsNode } from "../models/wbs";
import * as summaryPrompt from "../prompts/step09_summary";
import { generateJson } from "./llm/llmClient";

export async function generateSummary(env: Env, input: {
  jobId: string;
  mode: JobMode;
  nodes: WbsNode[];
  validationReport: ValidationReport;
  verifierIssues: any[];
  llm: { provider: "openai" | "anthropic" | "gemini"; model: string };
}) {
  const messages = [
    { role: "system" as const, content: summaryPrompt.SYSTEM_PROMPT },
    { role: "user" as const, content: summaryPrompt.buildUserPrompt(input) }
  ];

  const { json, rawText } = await generateJson<{ summary: string; highlights: string[]; qcNotes: string[] }>(env, {
    provider: input.llm.provider,
    model: input.llm.model,
    temperature: 0.3,
    maxTokens: 2048
  }, messages);

  return { summary: json, rawText };
}
