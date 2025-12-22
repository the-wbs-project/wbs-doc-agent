# Step 03: Normalize and Segment DI Output

## Overview
Transform raw DI output into a normalized internal representation, then segment into discrete regions (tables, paragraph blocks) for extraction. Output feeds into both **Step 03b (Global Analysis)** and **Step 04 (Region Extraction)**.

## Input
- `diRaw`: Raw DI response from Step 02

## Processing

### Normalization (`diNormalizeService.ts`)
Converts raw DI output to internal format. Handles nested `markdown` property from Azure DI backend:

```typescript
{
  raw: diRaw,              // preserve original for debugging
  link?: string,           // source document URL if available
  content: string,         // full markdown text
  pages: [                 // array of page objects
    {
      pageNumber: number,
      lines: [...],        // OCR lines with positions
      tables: [...],       // tables on this page
      paragraphs: [...]    // paragraphs grouped to this page
    }
  ],
  paragraphs: [...],       // flat array with page numbers
  tables: [...],           // extracted tables
  sections: [...]          // document sections hierarchy
}
```

Adapts to various DI output formats:
- Azure DI nested `markdown` structure
- Direct page/paragraph arrays
- Fallback to raw if structure unknown

Filters out non-content paragraphs:
- `pageHeader` - running headers
- `pageFooter` - running footers
- `pageNumber` - page numbers

### Segmentation (`segmentService.ts`)
Splits normalized output into regions for parallel processing:

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
- `diNormalized`: Normalized DI structure (used by Step 03b)
- `regions`: Array of `Region` objects (used by Step 03b and Step 04)

## Downstream Usage

### Step 03b: Global Document Analysis
Receives `diNormalized` and `regions` to build full document context:
- Full `content` string for pattern detection
- All regions for generating per-region guidance

### Step 04: Region Extraction
Receives `regions` for per-region LLM extraction, informed by Step 03b context.

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/di_normalized.json` | Normalized DI structure |
| `artifacts/{jobId}/regions.json` | Segmented regions array |

## DO Status Updates
- `step: "segment"`, `percent: 20`, `message: "Normalizing and segmenting DI output"`

## Logging
```json
{"ts":"...","level":"info","msg":"normalize_segment_done","jobId":"...","pages":12,"regions":24,"totalTokens":45000}
```

## Notes
- Token estimation uses crude `chars/4` approximation
- Region text is JSON-stringified for tables to preserve structure
- Paragraph blocks numbered (`1. ...`, `2. ...`) for reference in extraction
- Header/footer paragraphs filtered to avoid noise in extraction
- Large documents may produce many regions; Step 04 handles this via batching
