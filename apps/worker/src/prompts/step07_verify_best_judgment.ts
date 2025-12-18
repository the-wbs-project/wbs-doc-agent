import type { ValidationReport } from "../models/qc";
import type { WbsNode } from "../models/wbs";

export const PROMPT_ID = "step07_verify_best_judgment_v1";

export const JSON_SCHEMA_HINT = `
Return JSON ONLY:
{
  "correctedNodes": Array<WbsNode>,
  "issues": Array<{ "severity":"info"|"warn"|"error", "nodeId": string|null, "message": string, "regionId": string|null }>,
  "escalationPlan": { "needed": boolean, "targetRegionIds": Array<string>, "reason": string }
}

Rules:
- You may set inferred=true when inferring parent/hierarchy.
- Do not fabricate new tasks.
- provenance.quote must remain an exact substring from evidence.
`;

export const SYSTEM_PROMPT = `
You are a high-accuracy verifier for WBS extraction.
Improve hierarchy and consistency while remaining grounded in evidence.
Output JSON only.
`;

export function buildUserPrompt(input: {
  jobId: string;
  nodes: WbsNode[];
  validationReport: ValidationReport;
  regionsEvidence: Array<{ regionId: string; pageOrSheet: string; type: string; evidenceText: string; evidenceRefs: Record<string, any> }>;
}) {
  return `
JobId: ${input.jobId}
Mode: best_judgment

VALIDATION_REPORT:
${JSON.stringify(input.validationReport)}

NODES_DRAFT:
${JSON.stringify(input.nodes)}

EVIDENCE_BY_REGION:
${JSON.stringify(input.regionsEvidence)}

OUTPUT REQUIREMENTS:
${JSON_SCHEMA_HINT}

INFERENCE:
If you infer parent relationships, set inferred=true and add a warning explaining why.
`;
}
