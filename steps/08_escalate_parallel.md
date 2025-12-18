# Step 08: Escalate with Parallel Extraction

## Overview
If verifier requests escalation, re-extract targeted regions using 3 diverse LLM providers in parallel. A judge selects or merges the best result.

## Trigger
- `verifyOut.escalationPlan.needed === true`
- `verifyOut.escalationPlan.targetRegionIds` lists regions to re-extract

## Input
- `targetRegionIds`: From verifier's escalation plan
- `regions`: Full regions array from Step 03
- `job.mode`: `"strict"` | `"best_judgment"`
- Extract candidates (hardcoded diverse set):
  - OpenAI `gpt-4o-mini`
  - Anthropic `claude-3-5-haiku-latest`
  - Gemini `gemini-3-flash-preview`
- Judge: Same provider/model as verifier

## Processing (`escalateService.ts`)

### Per Target Region:
1. **Parallel Extraction**
   - Call all 3 candidates via `extractRegion()` concurrently
   - Each produces nodes + notes

2. **Judge Selection** (`step08_judge_merge.ts`)
   - System prompt: Evidence-based selection
   - User prompt includes:
     - Region evidence text and refs
     - All candidate outputs
   - Output strategies:
     - `pick_one`: Select winning candidate entirely
     - `merge`: Combine best parts from multiple candidates
   - Must explain rationale and problems with each candidate

### Patch Application
- Remove existing nodes matching target region (`provenance.regionId`)
- Insert selected/merged nodes

## Judge Output Schema
```typescript
{
  selected: {
    strategy: "pick_one" | "merge",
    winningCandidate: string | null,
    selectedNodes: WbsNode[]
  },
  rationale: string,
  problems: Array<{ candidate: string, issue: string }>
}
```

## Output
- `patches`: `Record<regionId, WbsNode[]>`

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/escalations/{regionId}/selected_patch.json` | Winning nodes for region |

## DO Status Updates
- `step: "escalate"`, `percent: 82`, `message: "Escalation required; re-extracting targeted regions"`

## Logging
```json
{"ts":"...","level":"warn","msg":"escalation_needed","jobId":"...","targets":["region-1","region-2"],"reason":"Ambiguous table structure"}
```

## Final Nodes Update
```typescript
// Remove nodes from target regions
finalNodes = finalNodes.filter(n => !targetSet.has(n.provenance?.regionId));

// Add patched nodes
for (const regionId of Object.keys(patches)) {
  finalNodes.push(...patches[regionId]);
}
```

## Notes
- Escalation is optional; skipped if `needed === false`
- Judge prefers evidence support over completeness
- All candidates run in parallel for speed
- Diverse providers reduce bias and catch different patterns
