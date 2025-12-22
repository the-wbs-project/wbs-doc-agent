import type { ValidationReport } from "../models/qc";
import type { WbsNode } from "../models/wbs";
import type { WbsWorkflowContext } from "../models/wbs-workflow-context";
import * as summaryPrompt from "../prompts/step09_summary";
import { generateJson } from "./llm/llmClient";

export async function generateSummary(ctx: WbsWorkflowContext, input: {
  nodes: WbsNode[];
  validationReport: ValidationReport;
  verifierIssues: any[];
  llm: { provider: "openai" | "anthropic" | "gemini"; model: string };
}) {
  const messages = [
    { role: "system" as const, content: summaryPrompt.SYSTEM_PROMPT },
    { role: "user" as const, content: summaryPrompt.buildUserPrompt(ctx.job.jobId, ctx.job.mode, input) }
  ];

  const { json, rawText } = await generateJson<{ summary: string; highlights: string[]; qcNotes: string[] }>(ctx, {
    provider: input.llm.provider,
    model: input.llm.model,
    temperature: 0.3,
  }, messages);

  return { summary: json, rawText };
}
