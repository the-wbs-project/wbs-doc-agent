# Step 06: Consolidate Document

## Overview
Merge extracted nodes into a coherent draft document. Attempt parent inference from WBS level numbering.

## Input
- `extractedNodes`: From Step 04
- `job.mode`: `"strict"` | `"best_judgment"`

## Processing (`consolidateService.ts`)

### Parent Inference from WBS Levels
1. Build map: `wbsLevel → node`
2. For each node without `parentId`:
   - Parse `wbsLevel` (e.g., `"1.4.3"`)
   - Compute parent level (e.g., `"1.4"`)
   - Look up parent node in map
   - If found, set `parentId`

### Mode-specific Behavior
| Mode | Action | `inferred` | Warning |
|------|--------|------------|---------|
| `strict` | Assign parent | `false` (unchanged) | `"parent_assigned_from_wbsLevel"` |
| `best_judgment` | Assign parent | `true` | `"inferred_parent_from_wbsLevel"` |

## Output
- `draftNodes`: Consolidated array with parent relationships populated

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/document_draft.json` | Consolidated nodes |

## DO Status Updates
- `step: "consolidate"`, `percent: 65`, `message: "Consolidating nodes"`

## Example
```typescript
// Input: two nodes
{ id: "a", parentId: null, wbsLevel: "1.4" }
{ id: "b", parentId: null, wbsLevel: "1.4.3" }

// Output: parent inferred
{ id: "a", parentId: null, wbsLevel: "1.4" }
{ id: "b", parentId: "a", wbsLevel: "1.4.3", inferred: true, warnings: ["inferred_parent_from_wbsLevel"] }
```

## Notes
- Only infers parent if matching parent level exists in dataset
- Does not create phantom parent nodes
- Single pass, no deep hierarchy resolution
