import type { Region } from "../models/regions";

export const PROMPT_ID = "step03b_global_analysis_v1";

export const JSON_SCHEMA_HINT = `
Return JSON ONLY, no markdown, no backticks.

{
  "documentPattern": "outline" | "matrix" | "flat_list" | "mixed" | "unknown",
  "structuralElements": {
    "columnHeaders": string[] | null,
    "hasPhaseColumns": boolean,
    "numberingScheme": string | null,
    "pageCount": number
  },
  "skeleton": {
    "nodes": Array<{
      "title": string,
      "suggestedWbsLevel": string,
      "parentTitle": string | null,
      "pageRefs": string[],
      "confidence": number
    }>,
    "notes": string
  },
  "regionGuidance": Array<{
    "regionId": string,
    "pageOrSheet": string,
    "context": {
      "sectionPath": string[],
      "suggestedParentWbs": string,
      "layoutHint": "outline" | "matrix" | "list" | "table" | "unknown",
      "columnHeaders": string[] | null,
      "rowHeader": string | null,
      "extractionNotes": string
    }
  }>,
  "warnings": string[]
}
`;

export const SYSTEM_PROMPT = `
You are an expert document analyst specializing in Work Breakdown Structure (WBS) extraction.

Your task is to analyze an ENTIRE document to understand its structure and provide guidance for detailed extraction.

DOCUMENT PATTERNS:
- "outline": Traditional hierarchical outline (1, 1.1, 1.1.1) with clear parent-child relationships
- "matrix": Row/column layout where rows are categories and columns are phases/stages (e.g., Predesign, Schematic Design, DD, CD)
- "flat_list": Sequential items without explicit hierarchy
- "mixed": Combination of patterns (e.g., outline with embedded tables)
- "unknown": Cannot determine pattern

KEY IDENTIFICATION TASKS:
1. Identify if column headers repeat across pages (phase columns like "Predesign", "Schematic Design", etc.)
2. Identify row headers (section/category names in leftmost position)
3. Determine the numbering scheme used (if any)
4. Build a top-level hierarchy skeleton
5. Provide specific guidance for each region

CRITICAL FOR MATRIX LAYOUTS:
- Column headers (phases) are NOT WBS items - they are organizational dimensions
- Row headers (categories like "SPECIFICATIONS", "SITE", "STRUCTURAL") ARE WBS items
- Items in cells are deliverables that belong to their row category
- Do NOT treat phase names as separate WBS nodes

OUTPUT REQUIREMENTS:
- skeleton.nodes should contain the TOP-LEVEL structure only (major sections)
- regionGuidance must include an entry for EACH region with specific extraction instructions
- suggestedWbsLevel should follow the document's numbering or suggest appropriate levels
- extractionNotes should explain what the region contains and how to extract it

Output JSON only, no explanations.
`;

export function buildUserPrompt(input: {
  jobId: string;
  fullContent: string;
  regions: Region[];
  pageCount: number;
  userContext?: string;
}) {
  const { jobId, fullContent, regions, pageCount, userContext } = input;

  const regionList = regions.map((r, i) =>
    `  ${i + 1}. regionId: ${r.regionId}, page: ${r.pageOrSheet}`
  ).join('\n');

  const userContextSection = userContext
    ? `
USER-PROVIDED CONTEXT:
The user has provided the following information about this document. Use this to guide your analysis:
${userContext}
`
    : "";

  return `
JobId: ${jobId}

Analyze this document to understand its structure and provide extraction guidance.
${userContextSection}
DOCUMENT STATISTICS:
- Total pages: ${pageCount}
- Total regions: ${regions.length}

REGIONS TO PROVIDE GUIDANCE FOR:
${regionList}

FULL DOCUMENT CONTENT:
${fullContent}

OUTPUT REQUIREMENTS:
${JSON_SCHEMA_HINT}

IMPORTANT:
1. For EACH region listed above, provide a regionGuidance entry
2. Identify the document's organizational pattern
3. Build a skeleton of the TOP-LEVEL sections only
4. For matrix layouts: column headers are sometimes phases, sometimes not. Check the user context to determine if they are WBS items. If no user context was provided, use your best judgement.
5. Provide clear extractionNotes for each region explaining:
   - What section/category this region belongs to
   - What the items represent (deliverables, tasks, milestones, etc.)
   - Any special handling needed (e.g., "ignore column headers", "items are sub-bullets")
`;
}
