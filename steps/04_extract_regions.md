# Step 04: Extract Regions (Context-Aware)

## Overview
For each region, call an LLM to extract WBS nodes. Each extraction is informed by the **global document analysis** from Step 03b, providing structural context that enables accurate hierarchy assignment.

## Input
- `regions`: Array from Step 03
- `globalAnalysis`: Document analysis from Step 03b
- `job.mode`: `"strict"` | `"best_judgment"`
- `extractProvider`/`extractModel` from job options or env defaults

## Key Improvement: Context-Aware Extraction
Unlike isolated per-region extraction, each LLM call now receives:
1. **Document pattern** (outline, matrix, flat_list, mixed)
2. **Hierarchy skeleton** with suggested WBS levels
3. **Region-specific guidance** (section path, layout hints, column/row headers)

This enables the LLM to:
- Correctly assign WBS levels relative to document structure
- Understand matrix layouts (don't treat column headers as WBS items)
- Maintain numbering continuity across pages
- Know where the region fits in the overall hierarchy

## Processing

### 1. Build Region Context
For each region, retrieve its guidance from `globalAnalysis.regionGuidance`:
```typescript
const regionContext = globalAnalysis.regionGuidance.find(
  g => g.regionId === region.regionId
);
```

### 2. Select Prompt Based on Mode
- `strict` → `step04_extract_strict.ts`
- `best_judgment` → `step04_extract_best_judgment.ts`

### 3. Build LLM Messages

**System Prompt** includes:
- Mode-specific rules (strict vs. best_judgment)
- Document pattern from global analysis
- General extraction guidelines

**User Prompt** includes:
- Region evidence text
- Region type and page reference
- **Context from global analysis:**
  ```
  DOCUMENT CONTEXT:
  - Document pattern: matrix
  - This region is within: GENERAL INFORMATION > SPECIFICATIONS
  - Suggested WBS prefix for items: 1.1.x
  - Layout: matrix with phase columns
  - Column headers (NOT WBS items): Predesign, Schematic Design, Design Development, Construction Documents
  - Row header: SPECIFICATIONS
  - Extraction notes: Items are deliverables grouped by phase. Assign as children of SPECIFICATIONS (1.1).
  ```
- JSON schema hint for response format

### 4. Call LLM via `generateJson()`
- Temperature: 0.2 (strict) or 0.35 (best_judgment)
- Max tokens: 4096

### 5. Post-process Extraction
- Ensure all nodes have `id` (generate if missing)
- Validate WBS levels against skeleton guidance
- Ensure `metadata` and `warnings` arrays exist
- Set default provenance if missing
- Add warning if extraction diverges significantly from skeleton

### 6. Parallel Batch Processing
Regions are processed in **batches of 3** for performance:
```typescript
const BATCH_SIZE = 3;
for (const batch of regionBatches) {
  await Promise.all(batch.map(region => extractRegion(region, context)));
}
```

## LLM Response Schema
```typescript
{
  regionId: string,
  confidence: number,      // 0-1
  notes: string,           // LLM observations about this region
  nodes: WbsNode[],        // extracted nodes
  unmappedEvidence: Array<{
    evidenceId: string,
    text: string,
    reason: string
  }>,
  skeletonAlignment: {     // NEW: How well extraction aligns with skeleton
    aligned: boolean,
    divergences: string[]  // e.g., "Created node not in skeleton: X"
  }
}
```

## WbsNode Schema
```typescript
{
  id: string,              // UUID
  parentId: string | null,
  title: string,
  description?: string,
  wbsLevel?: string,       // e.g., "1.1.3" - informed by global context
  metadata: KeyValue[],
  provenance: {
    regionId: string,
    pageOrSheet: string,
    sourceType: "table_cell" | "paragraph_span" | "unknown",
    diRefs: object,
    bbox?: BBox[],
    quote: string          // EXACT substring from evidence
  },
  inferred?: boolean,      // strict: always false
  warnings?: string[]
}
```

## Context-Aware WBS Assignment

### Without Context (Old Behavior)
Region sees only:
```
SPECIFICATIONS
Schematic Design
☐ Outline or preliminary specifications...
☐ Review and update assumptions...
```
Result: Flat nodes with sequential wbsLevel 1, 2, 3, 4...

### With Context (New Behavior)
Region sees:
```
DOCUMENT CONTEXT:
- Section path: GENERAL INFORMATION > SPECIFICATIONS
- Suggested WBS prefix: 1.1
- This is a matrix layout with phase columns
- Column headers are NOT WBS items

REGION CONTENT:
SPECIFICATIONS
Schematic Design
☐ Outline or preliminary specifications...
```
Result: Correctly nested nodes:
- "Outline or preliminary specifications" → wbsLevel: "1.1.1", parentId points to SPECIFICATIONS

## Output
- `extractedNodes`: Flat array of all nodes (with `jobId` attached)

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/extractions/region_{regionId}.json` | `{ extraction, rawText, contextUsed }` |

## DO Status Updates
- `step: "extract_regions"`, `percent: 30-55` (incrementing)
- Per-batch: `message: "Extracting regions {start}-{end} of {total}"`

## Logging
```json
{"ts":"...","level":"info","msg":"extract_region_start","jobId":"...","regionId":"...","type":"paragraph_block","tokenEstimate":500,"provider":"openai","model":"gpt-4o-mini","hasContext":true,"sectionPath":["GENERAL INFORMATION","SPECIFICATIONS"]}
{"ts":"...","level":"info","msg":"extract_region_done","jobId":"...","regionId":"...","nodes":5,"confidence":0.92,"skeletonAligned":true}
```

## Mode Differences
| Aspect | Strict | Best Judgment |
|--------|--------|---------------|
| `inferred` | Always `false` | May be `true` with explanation |
| `parentId` | Null if ambiguous | May infer from context + layout |
| Temperature | 0.2 | 0.35 |
| Skeleton divergence | Warning | Allowed with `inferred=true` |

## Handling Missing Context
If `globalAnalysis` is unavailable (failed Step 03b or fallback mode):
- Extract without context (legacy behavior)
- Add warning: `"extraction_without_global_context"`
- Expect lower accuracy on complex documents

## Error Handling
- Individual region failures don't fail the batch
- Failed regions logged with error, empty nodes returned
- Batch retries via Workflow step mechanism

## Notes
- Context is advisory; extraction can diverge if evidence contradicts skeleton
- Column headers identified by global analysis should NOT become WBS nodes
- WBS numbering should follow skeleton suggestions when evidence supports it
- Provenance `quote` must still be exact substring (context doesn't change this rule)
