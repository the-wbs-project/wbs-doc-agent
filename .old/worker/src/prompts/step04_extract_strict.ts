import type { JobMode } from "../models/job";
import type { Region } from "../models/regions";
import type { GlobalContext } from "../services/extractService";
import type { ColumnDecision } from "../workflows/wbs-steps/await-column-decision";

export const PROMPT_ID = "step04_extract_strict_v3";

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
  "inferred": false,
  "warnings": Array<string>
}
`;

export const SYSTEM_PROMPT = `
You are a meticulous document extraction engine for Work Breakdown Structures (WBS).

STRICT MODE:
- Do NOT invent tasks, headings, parents, or numbering not clearly in the content.
- Prefer leaving parentId null over guessing.
- Every node MUST have an exact quote from the markdown.
- Output valid JSON only.
- Page Names may or may not be WBS items. Check the context to determine if they are WBS items.

DOCUMENT CONTEXT AWARENESS:
When document context is provided, use it to:
- Understand where this region fits in the overall document hierarchy
- Apply correct WBS numbering if evidence clearly supports it
- In strict mode, only use context if content clearly supports it

MATRIX LAYOUT HANDLING:
If the document uses a matrix layout (rows = categories, columns = phases):
- Row headers ARE WBS categories (extract them)
- Items in cells are deliverables that belong to their row category
`;

export function buildUserPrompt(input: {
  jobId: string;
  mode: JobMode;
  region: Region;
  globalContext?: GlobalContext;
  userContext?: string;
  columnDecision?: ColumnDecision | null;
}) {
  const { jobId, region, globalContext, userContext, columnDecision } = input;

  const documentContexts: string[] = [];

  if (globalContext?.regionGuidance) {
    const g = globalContext.regionGuidance;

    documentContexts.push(`- Section path: ${g.sectionPath?.join(" > ") || "unknown"}`);
    documentContexts.push(`- Suggested WBS prefix: ${g.suggestedParentWbs || "determine from content"}`);
    documentContexts.push(`- Layout type: ${g.layoutHint}`);

    if (g.columnHeaders) {
      documentContexts.push(`- Column headers: ${g.columnHeaders.join(", ")}`);
      documentContexts.push(`- Are Column Headers Nodes?: ${columnDecision?.treatAsNodes ? "Yes" : "No"}`);
    }
    documentContexts.push(g.rowHeader ? `- Row header (IS a WBS category): ${g.rowHeader}` : "");
    documentContexts.push(`- Guidance: ${g.extractionNotes}`);

    documentContexts.push(`In strict mode, use context to avoid creating nodes for column headers, but do NOT infer parents unless clearly supported.`);
  }
  let contextSection = "DOCUMENT CONTEXT:\n\n";

  if (documentContexts.length === 0) {
    contextSection += `Not available. Extract based on content only.`;
  } else {
    contextSection += documentContexts.join("\n");
  }

  const userContextSection = userContext ? `USER-PROVIDED CONTEXT:\n\n${userContext}\n\n` : "";

  return `
JobId: ${jobId}
Mode: strict

Extract WBS nodes from this region.
${userContextSection}
${contextSection}
REGION:
- regionId: ${region.regionId}
- pageOrSheet: ${region.pageOrSheet}

MARKDOWN CONTENT:
${JSON.stringify(region.page)}

OUTPUT:
${JSON_SCHEMA_HINT}

RULES:
- "id" must be the WBS number ONLY (e.g., "2.2.1"), NOT the title
- Split "2.2.1 Columns" into id="2.2.1" and title="Columns"
- inferred must always be false
- If parent is unclear, parentId=null and add warning "ambiguous_parent"
- Set provenance.regionId="${region.regionId}" and provenance.pageOrSheet="${region.pageOrSheet}"
- Clean up artifacts like ":unselected:", ":selected:", bullet chars from titles
- Do NOT create nodes for column headers/phases identified in context
`;
}
