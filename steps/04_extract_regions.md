# Step 04: Extract Regions

## Overview
For each region, call an LLM to extract WBS nodes. Uses cheaper/faster models. Stores per-region extraction outputs including raw LLM text.

## Input
- `regions`: Array from Step 03
- `job.mode`: `"strict"` | `"best_judgment"`
- `extractProvider`/`extractModel` from job options or env defaults

## Processing
Iterates sequentially through regions:

1. Select prompt based on mode:
   - `strict` → `step04_extract_strict.ts`
   - `best_judgment` → `step04_extract_best_judgment.ts`

2. Build LLM messages:
   - System prompt (mode-specific rules)
   - User prompt with region evidence, refs, and JSON schema hint

3. Call LLM via `generateJson()`:
   - Temperature: 0.2 (strict) or 0.35 (best_judgment)
   - Max tokens: 4096

4. Post-process extraction:
   - Ensure all nodes have `id` (generate if missing)
   - Ensure `metadata` and `warnings` arrays exist
   - Set default provenance if missing

5. Store per-region artifact

## LLM Response Schema
```typescript
{
  regionId: string,
  confidence: number,      // 0-1
  notes: string,           // LLM observations
  nodes: WbsNode[],        // extracted nodes
  unmappedEvidence: Array<{
    evidenceId: string,
    text: string,
    reason: string
  }>
}
```

## WbsNode Schema
```typescript
{
  id: string,              // UUID
  parentId: string | null,
  title: string,
  description?: string,
  wbsLevel?: string,       // e.g., "1.4.3"
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

## Output
- `extractedNodes`: Flat array of all nodes (with `jobId` attached)

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/extractions/region_{regionId}.json` | `{ extraction, rawText }` |

## DO Status Updates
- `step: "extract_regions"`, `percent: 30-55` (incrementing)
- Per-region: `message: "Extracting region {i}/{n}"`

## Logging
```json
{"ts":"...","level":"info","msg":"extract_region_start","jobId":"...","regionId":"...","type":"table","tokenEstimate":500,"provider":"gemini","model":"gemini-3-flash-preview"}
{"ts":"...","level":"info","msg":"extract_region_done","jobId":"...","regionId":"...","nodes":5,"confidence":0.85}
```

## Mode Differences
| Aspect | Strict | Best Judgment |
|--------|--------|---------------|
| `inferred` | Always `false` | May be `true` |
| `parentId` | Null if ambiguous | May infer from layout |
| Temperature | 0.2 | 0.35 |
