# Step 07: Verify Document

## Overview
Use a stronger LLM to verify draft nodes against evidence. Fix issues, ensure provenance grounding, and determine if escalation is needed.

## Input
- `draftNodes`: From Step 06
- `validationReport`: From Step 05
- `regions`: From Step 03
- `job.mode`: `"strict"` | `"best_judgment"`
- `verifyProvider`/`verifyModel` from job options or env defaults

## Processing (`verifyService.ts`)

### Prompt Selection
- `strict` → `step07_verify_strict.ts`
- `best_judgment` → `step07_verify_best_judgment.ts`

### LLM Context
- Full validation report
- All draft nodes
- All regions with evidence text and refs

### LLM Task
1. Check each node's `provenance.quote` is exact substring of evidence
2. Fix obvious errors (typos, formatting)
3. Clear `parentId` if not supported (strict mode)
4. Identify regions needing re-extraction
5. Report issues with severity

### LLM Parameters
- Temperature: 0.15 (low for accuracy)
- Max tokens: 4096

## Output
```typescript
{
  correctedNodes: WbsNode[],
  issues: Array<{
    severity: "info" | "warn" | "error",
    nodeId: string | null,
    message: string,
    regionId: string | null
  }>,
  escalationPlan: {
    needed: boolean,
    targetRegionIds: string[],
    reason: string
  }
}
```

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/verifier_output.json` | `{ verifyOut, verifyRaw }` |

## DO Status Updates
- `step: "verify"`, `percent: 75`, `message: "Verifying document"`

## Logging
(Covered by workflow-level logging)

## Escalation Triggers
The verifier recommends escalation when:
- Evidence is too ambiguous for confident extraction
- Extraction appears incomplete (low coverage)
- Multiple conflicting interpretations possible
- Critical regions have unresolved issues

## Mode Differences
| Aspect | Strict | Best Judgment |
|--------|--------|---------------|
| Parent inference | Clears if unsupported | May set with `inferred=true` |
| Node invention | Forbidden | Forbidden |
| Quote accuracy | Exact match required | Exact match required |
