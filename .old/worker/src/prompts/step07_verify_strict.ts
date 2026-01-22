import type { ValidationReport } from "../models/qc";
import type { WbsNode } from "../models/wbs";

export const PROMPT_ID = "step07_verify_strict_v2";

export const JSON_SCHEMA_HINT = `
Return JSON ONLY:
{
  "correctedNodes": Array<WbsNode>,
  "issues": Array<{ "severity": "info" | "warn" | "error", "nodeId": string | null, "message": string, "regionId": string | null }>,
  "escalationPlan": { "needed": boolean, "targetRegionIds": Array<string>, "reason": string }
}

Strict rules:
- Do not invent nodes.
- Do not set inferred=true.
- Prefer clearing parentId over guessing.
`;

export const SYSTEM_PROMPT = `
You are a strict verification engine for WBS extraction.
Ensure nodes are content-backed. Fix obvious errors without inventing content.
Output JSON only.
`;

export function buildUserPrompt(input: {
  jobId: string;
  nodes: WbsNode[];
  validationReport: ValidationReport;
  regionsContent: Array<{ regionId: string; pageOrSheet: string; markdownContent: string }>;
}) {
  return `
JobId: ${input.jobId}
Mode: strict

VALIDATION_REPORT:
${JSON.stringify(input.validationReport)}

NODES_DRAFT:
${JSON.stringify(input.nodes)}

SOURCE_CONTENT_BY_REGION:
${JSON.stringify(input.regionsContent)}

OUTPUT:
${JSON_SCHEMA_HINT}

ESCALATION:
Set needed=true if content is too ambiguous or extraction seems incomplete; list regionIds.
`;
}
