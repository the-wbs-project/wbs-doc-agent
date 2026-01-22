import type { JobMode } from "../models/job";
import type { ValidationReport } from "../models/qc";
import type { WbsNode } from "../models/wbs";

export const PROMPT_ID = "step09_summary_v1";

export const SYSTEM_PROMPT = `
You are a concise technical writer. Summarize a WBS extraction result for an end user.
Be factual. Do not invent tasks.
Return JSON only.
`;

export const JSON_SCHEMA_HINT = `
Return JSON ONLY:
{ "summary": string, "highlights": Array<string>, "qcNotes": Array<string> }
`;

export function buildUserPrompt(jobId: string, mode: JobMode, input: {
  nodes: WbsNode[];
  validationReport: ValidationReport;
  verifierIssues: Array<{ severity: string; nodeId: string | null; message: string; regionId: string | null }>;
}) {
  const topLevel = input.nodes.filter(n => !n.parentId).slice(0, 25).map(n => ({ title: n.title, wbsLevel: n.wbsLevel ?? null }));
  return `
JobId: ${jobId}
Mode: ${mode}

NODES:
- total: ${input.nodes.length}
- topLevelSample: ${JSON.stringify(topLevel)}

QC:
${JSON.stringify({
    coverageRatio: input.validationReport.coverage.coverageRatio,
    unsupportedNodes: input.validationReport.unsupportedNodes.length,
    hierarchyIssues: input.validationReport.hierarchyIssues.length,
    numberingIssues: input.validationReport.numberingIssues.length
  })}

VerifierIssuesSample:
${JSON.stringify(input.verifierIssues.slice(0, 20))}

OUTPUT REQUIREMENTS:
${JSON_SCHEMA_HINT}
`;
}
