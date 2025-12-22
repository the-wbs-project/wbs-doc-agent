import type { JobMode } from "../models/job";
import type { ValidationReport } from "../models/qc";
import type { Region } from "../models/regions";
import type { WbsNode } from "../models/wbs";
import * as bestPrompt from "../prompts/step07_verify_best_judgment";
import * as strictPrompt from "../prompts/step07_verify_strict";
import { generateJson } from "./llm/llmClient";

export type VerifierIssue = { severity: "info" | "warn" | "error"; nodeId: string | null; message: string; regionId: string | null };
export type VerifyOutput = {
  correctedNodes: WbsNode[];
  issues: VerifierIssue[];
  escalationPlan: { needed: boolean; targetRegionIds: string[]; reason: string };
};

export async function verifyDocument(env: Env, input: {
  jobId: string;
  mode: JobMode;
  nodes: WbsNode[];
  validationReport: ValidationReport;
  regions: Region[];
  llm: { provider: "openai" | "anthropic" | "gemini"; model: string };
}) {
  const prompt = input.mode === "strict" ? strictPrompt : bestPrompt;

  const regionsEvidence = input.regions.map(r => ({
    regionId: r.regionId,
    pageOrSheet: r.pageOrSheet,
    type: r.type,
    evidenceText: r.text,
    evidenceRefs: r.evidenceRefs
  }));

  const messages = [
    { role: "system" as const, content: prompt.SYSTEM_PROMPT },
    {
      role: "user" as const, content: prompt.buildUserPrompt({
        jobId: input.jobId,
        nodes: input.nodes,
        validationReport: input.validationReport,
        regionsEvidence: regionsEvidence as any
      })
    }
  ];

  const { json, rawText } = await generateJson<VerifyOutput>(env, {
    provider: input.llm.provider,
    model: input.llm.model,
    temperature: 0.15,
  }, messages);

  return { out: json, rawText };
}
