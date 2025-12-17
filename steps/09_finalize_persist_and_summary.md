# Step 09: Finalize, Persist, and Summary

## Overview
Store final nodes to R2 and MongoDB. Generate human-readable summary. Update job record with counts.

## Input
- `finalNodes`: From Step 07 or Step 08
- `validationReport`: From Step 05
- `verifyOut.issues`: From Step 07
- `job.mode`: `"strict"` | `"best_judgment"`
- `summaryProvider`/`summaryModel` from job options or env defaults

## Processing

### 1. Store Final Nodes (R2)
- Artifact: `artifacts/{jobId}/document_final.json`

### 2. Persist to MongoDB
- Delete existing nodes for `jobId` (idempotent)
- Insert all `finalNodes` to `wbs_nodes` collection

### 3. Generate Summary (`summaryService.ts`)
Using `step09_summary.ts` prompt:

**LLM Context:**
- Total node count
- Sample of top-level nodes (first 25)
- QC metrics (coverage, issues counts)
- Sample of verifier issues (first 20)

**LLM Parameters:**
- Temperature: 0.3
- Max tokens: 2048

**Output:**
```typescript
{
  summary: string,      // Human-readable paragraph
  highlights: string[], // Key points
  qcNotes: string[]     // Quality concerns
}
```

### 4. Update Job Record
```typescript
await jobsRepo.markCompleted(env, jobId, {
  nodeCount: finalNodes.length,
  inferredCount: finalNodes.filter(n => n.inferred).length,
  coverageRatio: validationReport.coverage.coverageRatio
});
```

### 5. Mark DO Status Complete
- `state: "completed"`, `step: "done"`, `percent: 100`

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/document_final.json` | Final nodes array |
| `artifacts/{jobId}/summary.json` | `{ summary, summaryRaw }` |

## MongoDB Updates
| Collection | Action |
|------------|--------|
| `wbs_nodes` | Replace all nodes for jobId |
| `jobs` | Update state, counts, updatedAt |

## DO Status Updates
- `step: "persist"`, `percent: 92`, `message: "Persisting nodes to MongoDB"`
- `step: "summary"`, `percent: 96`, `message: "Generating summary"`
- `state: "completed"`, `step: "done"`, `percent: 100`, `message: "Completed"`

## Logging
```json
{"ts":"...","level":"info","msg":"workflow_completed","jobId":"...","scope":"workflow","nodes":42,"inferredCount":5}
```

## Job Record Final State
```json
{
  "jobId": "...",
  "state": "completed",
  "nodeCount": 42,
  "inferredCount": 5,
  "coverageRatio": 0.87,
  "updatedAt": "2025-..."
}
```
