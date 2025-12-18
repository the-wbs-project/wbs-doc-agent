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
  "id": string,              // The WBS level number ONLY (e.g., "1", "1.2", "2.2.1"). Do NOT include the title here.
  "parentId": string | null, // The parent's id (WBS level), or null if root/unknown
  "title": string,           // The task/item name ONLY, without the WBS number (e.g., "Columns", "Steel Erection")
  "description": string | null,
  "wbsLevel": string | null, // Same as id - the hierarchical WBS numbering (e.g., "2.2.1")
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
- IMPORTANT: The "id" field must contain ONLY the WBS level number (e.g., "2.2.1"), NOT the title. Split "2.2.1 Columns" into id="2.2.1" and title="Columns".
- inferred must always be false.
- If parent is unclear, parentId=null and add warning "ambiguous_parent".
- Always set provenance.regionId="${region.regionId}" and provenance.pageOrSheet="${region.pageOrSheet}".
`;
}
