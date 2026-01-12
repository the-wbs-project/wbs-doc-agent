import type { GlobalContext } from "../services/extractService";
import type { JobMode } from "../models/job";
import type { Region } from "../models/regions";

export const PROMPT_ID = "step04_extract_best_judgment_v3";

export const JSON_SCHEMA_HINT = `
Return JSON ONLY, no markdown fences, no backticks.

{
  "regionId": string,
  "confidence": number,
  "notes": string,
  "nodes": Array<WbsNode>,
  "unmappedContent": Array<{ "text": string, "reason": string }>
}

WbsNode shape:
{
  "id": string,              // WBS level number ONLY (e.g., "1", "1.2", "2.2.1")
  "parentId": string | null, // Parent's WBS level, or null if root/unknown
  "title": string,           // Task name WITHOUT the WBS number
  "description": string | null,
  "wbsLevel": string | null, // Same as id
  "metadata": Array<{ "key": string, "value": string }>,
  "provenance": {
    "regionId": string,
    "pageOrSheet": string,
    "sourceType": "table_cell" | "paragraph" | "list_item" | "heading" | "unknown",
    "quote": string
  },
  "inferred": boolean,
  "warnings": Array<string>
}
`;

export const SYSTEM_PROMPT = `
You are an expert project analyst extracting a Work Breakdown Structure (WBS) from document content.

BEST-JUDGMENT MODE:
- You may infer hierarchy when strongly implied (layout/indentation/numbering).
- Do not invent tasks not present in the content.
- If you infer parentId, set inferred=true and explain in warnings.
- provenance.quote must be an exact substring from the provided markdown.
- Output JSON only.
- Page Names may or may not be WBS items. Check the context to determine if they are WBS items.

DOCUMENT CONTEXT AWARENESS:
When document context is provided, use it to:
- Understand where this region fits in the overall document hierarchy
- Apply correct WBS numbering relative to the suggested parent
- Recognize column headers (in matrix layouts) as organizational elements, NOT WBS items
- Follow the document's numbering scheme

MATRIX LAYOUT HANDLING:
If the document uses a matrix layout (rows = categories, columns = phases):
- Row headers ARE WBS categories (extract them)
- Column headers (phases like "Predesign", "Schematic Design") are MAY BE WBS items. Check the context to determine if they are WBS items.
- Items in cells are deliverables that belong to their row category
`;

export function buildUserPrompt(input: {
  jobId: string;
  mode: JobMode;
  region: Region;
  globalContext?: GlobalContext;
}) {
  const { jobId, region, globalContext } = input;

  let contextSection = "";
  if (globalContext?.regionGuidance) {
    const g = globalContext.regionGuidance;
    contextSection = `
DOCUMENT CONTEXT:
- Section path: ${g.sectionPath?.join(" > ") ?? "unknown"}
- Suggested WBS prefix: ${g.suggestedParentWbs || "determine from content"}
- Layout type: ${g.layoutHint}
${g.columnHeaders ? `- Column headers (NOT WBS items): ${g.columnHeaders.join(", ")}` : ""}
${g.rowHeader ? `- Row header (IS a WBS category): ${g.rowHeader}` : ""}
- Guidance: ${g.extractionNotes}

Use the suggested WBS prefix to number items (e.g., if prefix is "1.1", items should be "1.1.1", "1.1.2", etc.)
`;
  } else {
    contextSection = `
DOCUMENT CONTEXT: Not available. Extract based on content only.
`;
  }

  return `
JobId: ${jobId}
Mode: best_judgment

Extract WBS nodes from this region into a flat list.
${contextSection}
REGION:
- regionId: ${region.regionId}
- pageOrSheet: ${region.pageOrSheet}

MARKDOWN CONTENT:
${region.text}

OUTPUT:
${JSON_SCHEMA_HINT}

RULES:
- "id" must be the WBS number ONLY (e.g., "2.2.1"), NOT the title
- Split "2.2.1 Columns" into id="2.2.1" and title="Columns"
- If you normalize title, add metadata {key:"original_text", value:"<original>"}
- If you infer parentId, set inferred=true with appropriate warning
- Set provenance.regionId="${region.regionId}" and provenance.pageOrSheet="${region.pageOrSheet}"
- Clean up artifacts like ":unselected:", ":selected:", bullet chars from titles
- Do NOT create nodes for column headers/phases identified in context
`;
}
