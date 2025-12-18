import type { Region } from "../models/regions";
import type { JobMode } from "../models/job";

export const PROMPT_ID = "step04_extract_strict_v1";

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
  "inferred": false,
  "warnings": Array<string>
}
`;

export const SYSTEM_PROMPT = `
You are a meticulous document extraction engine for Work Breakdown Structures (WBS).
Extract WBS items from the provided region evidence into a FLAT list of nodes.

STRICT MODE:
- Do NOT invent tasks, headings, parents, or numbering not clearly supported by evidence.
- Prefer leaving parentId null over guessing.
- Every node MUST be grounded with an exact quote and reference identifiers.
- Output valid JSON only (no markdown).
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
Mode: strict

Extract WBS nodes from this SINGLE region.

REGION:
- regionId: ${region.regionId}
- pageOrSheet: ${region.pageOrSheet}
- type: ${region.type}

EVIDENCE_TEXT (quotes MUST be exact substrings):
${evidenceBundle.text}

EVIDENCE_REFS (use these in diRefs):
${JSON.stringify(evidenceBundle.evidenceRefs)}

OUTPUT REQUIREMENTS:
${JSON_SCHEMA_HINT}

RULES:
- inferred must always be false.
- If parent is unclear, parentId=null and add warning "ambiguous_parent".
- Always set provenance.regionId="${region.regionId}" and provenance.pageOrSheet="${region.pageOrSheet}".
`;
}
