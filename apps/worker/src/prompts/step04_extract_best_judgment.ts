import type { GlobalContext } from "../services/extractService";
import type { JobMode } from "../models/job";
import type { Region } from "../models/regions";

export const PROMPT_ID = "step04_extract_best_judgment_v2";

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

DOCUMENT CONTEXT AWARENESS:
When document context is provided, use it to:
- Understand where this region fits in the overall document hierarchy
- Apply correct WBS numbering relative to the suggested parent
- Recognize column headers (in matrix layouts) as organizational elements, NOT WBS items
- Follow the document's numbering scheme

MATRIX LAYOUT HANDLING:
If the document uses a matrix layout (rows = categories, columns = phases):
- Row headers ARE WBS categories (extract them)
- Column headers (phases like "Predesign", "Schematic Design") are NOT WBS items - do not create nodes for them
- Items in cells are deliverables that belong to their row category
`;

export function buildUserPrompt(input: {
  jobId: string;
  mode: JobMode;
  region: Region;
  evidenceBundle: { pageOrSheet: string; regionId: string; type: string; text: string; evidenceRefs: Record<string, any> };
  globalContext?: GlobalContext;
}) {
  const { jobId, region, evidenceBundle, globalContext } = input;

  // Build context section if global context is available
  let contextSection = "";
  if (globalContext && globalContext.regionGuidance) {
    const g = globalContext.regionGuidance;
    contextSection = `
DOCUMENT CONTEXT (use this to guide extraction):
- Document pattern: ${globalContext.documentPattern}
- This region is within section path: ${g.sectionPath?.join(" > ") || "unknown"}
- Suggested WBS prefix for items in this region: ${g.suggestedParentWbs || "determine from evidence"}
- Layout type: ${g.layoutHint}
${g.columnHeaders ? `- Column headers (NOT WBS items, these are phases): ${g.columnHeaders.join(", ")}` : ""}
${g.rowHeader ? `- Row header (this IS a WBS category): ${g.rowHeader}` : ""}
- Extraction guidance: ${g.extractionNotes}

IMPORTANT:
- If column headers are listed above, do NOT create WBS nodes for them
- Use the suggested WBS prefix to number items correctly (e.g., if prefix is "1.1", items should be "1.1.1", "1.1.2", etc.)
- Items belong to the row category, not the column phase
`;
  } else {
    contextSection = `
DOCUMENT CONTEXT: Not available. Extract items based on evidence only.
`;
  }

  return `
JobId: ${jobId}
Mode: best_judgment

Extract WBS nodes from this SINGLE region into a flat list. Use best judgment to form a clean WBS while preserving meaning.
${contextSection}
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
- IMPORTANT: The "id" field must contain ONLY the WBS level number (e.g., "2.2.1"), NOT the title. Split "2.2.1 Columns" into id="2.2.1" and title="Columns".
- If you normalize title, add metadata {key:"original_text", value:"<original>"}.
- If you infer parentId, set inferred=true and warning "inferred_parent_from_layout" or similar.
- Always set provenance.regionId="${region.regionId}" and provenance.pageOrSheet="${region.pageOrSheet}".
- Clean up artifacts like ":unselected:", ":selected:", bullet characters (·, •) from titles.
- Do NOT create nodes for column headers/phases if they were identified in the document context.
`;
}
