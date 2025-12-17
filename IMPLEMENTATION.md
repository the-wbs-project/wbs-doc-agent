# WBS-to-JSON Pipeline Implementation

A Cloudflare Workers + Workflows pipeline that extracts Work Breakdown Structures from documents (PDF/Excel/Image) using Azure Document Intelligence and LLMs.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  POST /jobs │────▶│  WbsWorkflow     │────▶│  MongoDB Atlas  │
│  (Hono)     │     │  (CF Workflow)   │     │  (Data API)     │
└─────────────┘     └──────────────────┘     └─────────────────┘
       │                    │                        │
       │                    ▼                        │
       │           ┌────────────────┐               │
       │           │  DI Backend    │               │
       │           │  (external)    │               │
       │           └────────────────┘               │
       │                    │                        │
       ▼                    ▼                        │
┌─────────────┐     ┌──────────────────┐           │
│  R2 Bucket  │◀───▶│  KV (DI Cache)   │           │
│  (uploads/  │     └──────────────────┘           │
│  artifacts/)│                                     │
└─────────────┘     ┌──────────────────┐           │
       │           │  JobStatusDO     │◀──────────┘
       │           │  (Durable Obj)   │
       │           └──────────────────┘
       │                    ▲
       │                    │
       │           ┌────────────────────┐
       └──────────▶│  GET /jobs/:id/*   │
                   └────────────────────┘
```

## Quick Start

```bash
# Install dependencies
npm install

# Configure wrangler.jsonc with your KV ID and secrets
# Set secrets:
wrangler secret put MONGO_DATA_API_KEY
wrangler secret put R2_ACCESS_KEY_ID
wrangler secret put R2_SECRET_ACCESS_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put GEMINI_API_KEY

# Deploy
npm run deploy
```

## API Endpoints

### Create Job
```http
POST /jobs
Content-Type: multipart/form-data

file: <binary>
mode: "strict" | "best_judgment"
options: {"extractProvider": "gemini", ...}
```

Response: `202 Accepted`
```json
{ "jobId": "uuid" }
```

### Get Status (polling)
```http
GET /jobs/:jobId/status
```

Response:
```json
{
  "jobId": "...",
  "state": "running",
  "step": "extract_regions",
  "percent": 45,
  "messages": [...],
  "errors": []
}
```

### Get Result
```http
GET /jobs/:jobId/result
```

Response (when completed):
```json
{
  "jobId": "...",
  "mode": "strict",
  "summary": { "summary": "...", "highlights": [...], "qcNotes": [...] },
  "qc": { "nodeCount": 42, "inferredCount": 5, "coverageRatio": 0.87 },
  "nodes": [...],
  "artifacts": { "r2Prefix": "artifacts/{jobId}/" }
}
```

## Pipeline Steps

| Step | Description | Percent |
|------|-------------|---------|
| 01 | Ingest & Store | 0-2% |
| 02 | Azure DI + Cache | 2-20% |
| 03 | Normalize & Segment | 20% |
| 04 | Extract Regions | 30-55% |
| 05 | Validate & QC | 60% |
| 06 | Consolidate | 65% |
| 07 | Verify | 75% |
| 08 | Escalate (optional) | 82% |
| 09 | Finalize & Summary | 92-100% |

See `/steps/*.md` for detailed documentation of each step.

## WBS Node Schema

```typescript
{
  jobId: string,
  id: string,           // UUID
  parentId: string | null,
  title: string,
  description?: string,
  wbsLevel?: string,    // e.g., "1.4.3"
  metadata: KeyValue[],
  provenance: {
    regionId: string,
    pageOrSheet: string,
    sourceType: "table_cell" | "paragraph_span" | "unknown",
    diRefs: object,
    bbox?: BBox[],
    quote: string       // exact substring from evidence
  },
  inferred?: boolean,
  warnings?: string[]
}
```

## Modes

| Mode | Description |
|------|-------------|
| `strict` | No inference; `inferred` always false; prefer `parentId: null` if ambiguous |
| `best_judgment` | May infer hierarchy; must set `inferred: true` with explanation |

## Environment Variables

### Required Secrets
- `MONGO_DATA_API_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`

### Configuration (wrangler.jsonc vars)
- `DI_BACKEND_URL` - Azure DI micro-backend endpoint
- `DI_MODEL` - DI model name (default: `prebuilt-layout`)
- `DI_CACHE_TTL_SECONDS` - Cache TTL (default: 604800 = 7 days)
- `MONGO_DATA_API_URL` - MongoDB Atlas Data API endpoint
- `LLM_DEFAULT_*_PROVIDER` - Default providers for extract/verify/judge/summary

## Code Organization

```
src/
├── index.ts              # Hono app + exports
├── env.ts                # Environment types
├── routes/
│   └── jobs.ts           # API routes
├── workflows/
│   └── wbsWorkflow.ts    # Main orchestration
├── services/
│   ├── artifactsService.ts
│   ├── azureDiService.ts
│   ├── consolidateService.ts
│   ├── diNormalizeService.ts
│   ├── escalateService.ts
│   ├── extractService.ts
│   ├── kvCacheService.ts
│   ├── r2PresignService.ts
│   ├── r2Service.ts
│   ├── segmentService.ts
│   ├── summaryService.ts
│   ├── validateService.ts
│   ├── verifyService.ts
│   ├── llm/
│   │   ├── llmClient.ts
│   │   ├── json.ts
│   │   └── providers/
│   │       ├── anthropic.ts
│   │       ├── gemini.ts
│   │       └── openai.ts
│   └── mongo/
│       ├── mongoDataApiClient.ts
│       └── repositories/
│           ├── artifactsRepo.ts
│           ├── jobsRepo.ts
│           └── nodesRepo.ts
├── status/
│   ├── statusDO.ts       # Durable Object
│   └── statusClient.ts   # DO client functions
├── models/
│   ├── api.ts
│   ├── job.ts
│   ├── qc.ts
│   ├── regions.ts
│   └── wbs.ts
└── prompts/
    ├── step04_extract_strict.ts
    ├── step04_extract_best_judgment.ts
    ├── step07_verify_strict.ts
    ├── step07_verify_best_judgment.ts
    ├── step08_judge_merge.ts
    └── step09_summary.ts
```

## R2 Artifact Structure

```
uploads/{jobId}/{filename}              # Original file
artifacts/{jobId}/
├── di_raw.json                         # Fresh DI response
├── di_cached.json                      # Cached DI response
├── di_normalized.json                  # Normalized structure
├── regions.json                        # Segmented regions
├── extractions/
│   └── region_{regionId}.json          # Per-region extraction
├── validation_report.json              # QC report
├── document_draft.json                 # Consolidated draft
├── verifier_output.json                # Verifier response
├── escalations/
│   └── {regionId}/
│       └── selected_patch.json         # Escalation winner
├── document_final.json                 # Final nodes
└── summary.json                        # Generated summary
```

## MongoDB Collections

| Collection | Description |
|------------|-------------|
| `jobs` | Job records with state, counts, options |
| `wbs_nodes` | Flat node documents (one per node) |
| `job_artifacts` | Artifact pointer records |
