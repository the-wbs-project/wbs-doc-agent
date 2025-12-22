# Step 03b: Global Document Analysis

## Overview
Use a powerful LLM with large context window to analyze the **entire document** at once. This step produces a document schema, structural skeleton, and extraction guidance that will inform per-region extraction in Step 04.

## Rationale
Per-region extraction (Step 04) operates in isolation and cannot understand:
- Where a section fits in the overall document hierarchy
- Document-wide patterns (matrix layouts, phase-based columns, outline styles)
- Numbering schemes that span pages
- Relationships between sections on different pages

The global analysis solves this by providing context to downstream extraction.

## Input
- `diNormalized`: Normalized DI structure from Step 03
- `regions`: Segmented regions from Step 03
- `job.mode`: `"strict"` | `"best_judgment"`
- `globalProvider`/`globalModel`: LLM with large context window (e.g., Claude 200k, Gemini 1M, GPT-4o 128k)

## Processing (`globalAnalysisService.ts`)

### 1. Build Full Document Context
Concatenate all region text with page markers:
```
=== PAGE 1 ===
[Region 1 content]

=== PAGE 2 ===
[Region 2 content]
...
```

### 2. LLM Analysis (`step03b_global_analysis.ts`)
Single LLM call with full document to identify:

#### Document Pattern Classification
- `outline`: Traditional hierarchical outline (1, 1.1, 1.1.1)
- `matrix`: Row/column layout (e.g., categories vs. phases)
- `flat_list`: Sequential items without hierarchy
- `mixed`: Combination of patterns
- `unknown`: Cannot determine pattern

#### Structural Elements
- **Column headers**: Repeating headers across pages (e.g., "Predesign", "Schematic Design")
- **Row headers**: Section/category labels in leftmost position
- **Phase indicators**: Project phases, stages, or milestones
- **Numbering scheme**: WBS numbering format used (if any)

#### Hierarchy Skeleton
Top-level structure with preliminary WBS assignments:
```typescript
{
  nodes: [
    { title: "GENERAL INFORMATION", suggestedWbsLevel: "1", pageRefs: ["page:1", "page:2"] },
    { title: "SPECIFICATIONS", suggestedWbsLevel: "1.1", pageRefs: ["page:3"], parentTitle: "GENERAL INFORMATION" },
    { title: "SITE", suggestedWbsLevel: "1.2", pageRefs: ["page:4"], parentTitle: "GENERAL INFORMATION" },
    ...
  ]
}
```

#### Per-Region Guidance
Instructions for each region's extraction:
```typescript
{
  regionId: "abc-123",
  pageOrSheet: "page:3",
  context: {
    sectionPath: ["GENERAL INFORMATION", "SPECIFICATIONS"],
    suggestedParentWbs: "1.1",
    layoutHint: "matrix",
    columnHeaders: ["Predesign", "Schematic Design", "Design Development", "Construction Documents"],
    rowHeader: "SPECIFICATIONS",
    extractionNotes: "Items are deliverables grouped by phase column. Do not treat column headers as WBS items."
  }
}
```

### 3. LLM Parameters
- **Model**: Large context (Claude claude-sonnet-4-20250514, Gemini gemini-2.0-flash, GPT-4o)
- **Temperature**: 0.2 (structured analysis)
- **Max tokens**: 8192

## Output Schema
```typescript
interface GlobalAnalysis {
  documentPattern: "outline" | "matrix" | "flat_list" | "mixed" | "unknown";

  structuralElements: {
    columnHeaders?: string[];          // Repeating column headers
    hasPhaseColumns: boolean;          // Document organized by phases
    numberingScheme?: string;          // e.g., "1.1.1", "A.1.a", "none"
    pageCount: number;
  };

  skeleton: {
    nodes: Array<{
      title: string;
      suggestedWbsLevel: string;
      parentTitle: string | null;
      pageRefs: string[];
      confidence: number;
    }>;
    notes: string;
  };

  regionGuidance: Array<{
    regionId: string;
    pageOrSheet: string;
    context: {
      sectionPath: string[];           // Breadcrumb path to this region
      suggestedParentWbs: string;      // WBS level for items in this region
      layoutHint: "outline" | "matrix" | "list" | "table" | "unknown";
      columnHeaders?: string[];        // If matrix layout
      rowHeader?: string;              // If matrix layout
      extractionNotes: string;         // Free-form guidance
    };
  }>;

  warnings: string[];                  // Issues detected in document structure
}
```

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/global_analysis.json` | Full analysis output |

## DO Status Updates
- `step: "global_analysis"`, `percent: 25`, `message: "Analyzing document structure"`

## Logging
```json
{"ts":"...","level":"info","msg":"global_analysis_start","jobId":"...","tokenEstimate":45000,"provider":"anthropic","model":"claude-sonnet-4-20250514"}
{"ts":"...","level":"info","msg":"global_analysis_done","jobId":"...","pattern":"matrix","skeletonNodes":12,"ms":8500}
```

## Document Pattern Examples

### Outline Pattern
```
1. Project Management
   1.1 Planning
      1.1.1 Schedule Development
      1.1.2 Resource Allocation
   1.2 Execution
      1.2.1 Task Tracking
```
**Guidance**: Follow explicit numbering. Parent relationships are clear.

### Matrix Pattern
```
              | Phase A  | Phase B  | Phase C  |
--------------+----------+----------+----------+
Category 1    | Item 1.1 | Item 1.2 | Item 1.3 |
Category 2    | Item 2.1 | Item 2.2 | Item 2.3 |
```
**Guidance**: Row headers are WBS categories. Column headers are phases (not WBS items). Items belong to their row category.

### Flat List Pattern
```
- Task Alpha
- Task Beta
- Task Gamma
```
**Guidance**: No hierarchy evident. Assign flat wbsLevel or group under synthetic parent.

### Mixed Pattern
```
1. Overview Section
   - Introduction text

| Deliverable | Due Date |
|-------------|----------|
| Report A    | Q1       |
| Report B    | Q2       |

2. Technical Section
   2.1 Requirements
```
**Guidance**: Combine strategies. Tables within sections inherit section's WBS path.

## Error Handling
- If document exceeds context limit, truncate with priority:
  1. Keep first page (often contains TOC/overview)
  2. Keep section headers from all pages
  3. Sample content from middle pages
- If analysis fails, fall back to empty guidance (Step 04 proceeds without context)

## Notes
- This step is critical for accurate hierarchy extraction
- Uses more expensive/powerful model but only called once per document
- Output is passed to every Step 04 region extraction
- Skeleton is advisory; Step 04 extractions are authoritative for node details
