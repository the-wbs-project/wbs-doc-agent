# Step 03: Normalize and Segment DI Output

## Overview
Transform raw DI output into a normalized internal representation, then segment into discrete regions (tables, paragraph blocks) for parallel extraction.

## Input
- `diRaw`: Raw DI response from Step 02

## Processing

### Normalization (`diNormalizeService.ts`)
Converts raw DI output to internal format:
```typescript
{
  raw: diRaw,          // preserve original
  pages: [...],        // array of page objects
  tables: [...],       // extracted tables
  paragraphs: [...]    // paragraph content
}
```

Adapts to various DI output formats. If structure unknown, preserves raw for fallback segmentation.

### Segmentation (`segmentService.ts`)
Splits normalized output into regions:

1. **Per-page tables**: Each table becomes a region of type `"table"`
2. **Per-page paragraph blocks**: All paragraphs on a page become a single `"paragraph_block"` region
3. **Fallback**: If no pages/tables/paragraphs found, creates single `"unknown"` region with truncated raw JSON

Each region includes:
```typescript
{
  regionId: string,        // UUID
  type: "table" | "paragraph_block" | "drawing" | "unknown",
  pageOrSheet: string,     // e.g., "page:1"
  text: string,            // serialized content for LLM
  evidenceRefs: object,    // IDs for provenance tracking
  tokenEstimate: number    // ~chars/4
}
```

## Output
- `diNormalized`: Normalized DI structure
- `regions`: Array of `Region` objects

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/di_normalized.json` | Normalized DI structure |
| `artifacts/{jobId}/regions.json` | Segmented regions array |

## DO Status Updates
- `step: "segment"`, `percent: 20`, `message: "Normalizing and segmenting DI output"`

## Logging
(No explicit logging in this step; covered by workflow-level logging)

## Notes
- Token estimation uses crude `chars/4` approximation
- Region text is JSON-stringified for tables to preserve structure
- Paragraph blocks numbered (`1. ...`, `2. ...`) for reference
