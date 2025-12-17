# Step 05: Validate and QC

## Overview
Perform deterministic validation on extracted nodes. Generate QC metrics and identify issues for verifier review.

## Input
- `extractedNodes`: Array of `WbsNode` from Step 04
- `regions`: From Step 03

## Processing (`validateService.ts`)
Runs checks without LLM:

### 1. Schema Validation
- Missing `title` → `unsupportedNodes`
- Missing `provenance.quote` → `unsupportedNodes`

### 2. Duplicate Detection
Key: `{title.toLowerCase()}|{wbsLevel}|{quote}`
- Nodes with same key → `duplicates`

### 3. Hierarchy Issues
- `parentId === id` (self-reference) → `hierarchyIssues`

### 4. Numbering Issues
- `wbsLevel` format check (regex: `^[A-Za-z0-9]+(\.[A-Za-z0-9]+)*$`)
- Suspicious formats → `numberingIssues`

### 5. Coverage Calculation
```typescript
totalEvidenceCount = sum(regions.text.split('\n').length)
consumedEvidenceCount = nodes.length
coverageRatio = consumed / total  // capped at 1.0
```

### 6. Region Risk Scores
Per-region risk assessment (currently returns 0 with empty reasons; extensible).

## Output
```typescript
{
  schemaValid: boolean,
  unsupportedNodes: Array<{ nodeId, reason }>,
  duplicates: Array<{ nodeIds, reason }>,
  numberingIssues: Array<{ nodeId, issue }>,
  hierarchyIssues: Array<{ nodeId, issue }>,
  coverage: {
    consumedEvidenceCount: number,
    totalEvidenceCount: number,
    coverageRatio: number
  },
  regionRiskScores: Array<{ regionId, risk, reasons }>
}
```

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/validation_report.json` | Full validation report |

## DO Status Updates
- `step: "validate"`, `percent: 60`, `message: "Validating and generating QC report"`

## Usage
Validation report is passed to:
- **Verifier** (Step 07) for context on issues
- **Summary** (Step 09) for QC notes
- **Job record** for `coverageRatio` field
