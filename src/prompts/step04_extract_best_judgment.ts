import type { Region } from "../models/regions";
import type { JobMode } from "../models/job";

export const PROMPT_ID = "step04_extract_best_judgment_v1";

export const JSON_SCHEMA_HINT = `
Return JSON ONLY, no markdown, no backticks.

Top-level JSON object:
{
  "regionId": string,
  "confidence": number,
  "notes": string,
  "nodes": Array<WbsNode>,
  "unmappedEvidence": Array<{ "evidenceId": string, "text": string, "reason": string }>
}

WbsNode JSON shape (flat):
{
  "id": string,
  "parentId": string | null,
  "title": string,
  "description": string | null,
  "wbsLevel": string | null,
  "metadata": Array<{ "key": string, "value": string }>,
  "provenance": {
    "regionId": string,
    "pageOrSheet": string,
    "sourceType": "table_cell" | "paragraph_span" | "unknown",
    "diRefs": object,
    "bbox": Array<{ "x": number, "y": number, "w": number, "h": number, "page": number }> | null,
    "quote": string
  },
  "inferred": boolean,
  "warnings": Array<string>
}
`;

export const SYSTEM_PROMPT = `
You are an expert project analyst extracting a Work Breakdown Structure (WBS) from document evidence.

BEST-JUDGMENT MODE:
- You may infer hierarchy when strongly implied (layout/indentation/numbering).
- Do not invent tasks not present in evidence.
- If you infer parentId, set inferred=true and explain in warnings.
- provenance.quote must be an exact substring of evidence.
- Output JSON only.
`;

export function buildUserPrompt(input: {
  jobId: string;
  mode: JobMode;
  region: Region;
  evidenceBundle: { pageOrSheet: string; regionId: string; type: string; text: string; evidenceRefs: Record<string, any> };
}) {
  const { jobId, region, evidenceBundle } = input;

  return `
JobId: ${jobId}
Mode: best_judgment

Extract WBS nodes from this SINGLE region into a flat list. Use best judgment to form a clean WBS while preserving meaning.

REGION:
- regionId: ${region.regionId}
- pageOrSheet: ${region.pageOrSheet}
- type: ${region.type}

EVIDENCE_TEXT (quotes MUST be exact substrings):
${evidenceBundle.text}

EVIDENCE_REFS:
${JSON.stringify(evidenceBundle.evidenceRefs)}

OUTPUT REQUIREMENTS:
${JSON_SCHEMA_HINT}

RULES:
- If you normalize title, add metadata {key:"original_text", value:"<original>"}.
- If you infer parentId, set inferred=true and warning "inferred_parent_from_layout" or similar.
- Always set provenance.regionId="${region.regionId}" and provenance.pageOrSheet="${region.pageOrSheet}".
`;
}
