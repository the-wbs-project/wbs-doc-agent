# Step 01: Ingest and Store

## Overview
Accepts file upload via `POST /jobs`, stores raw file in R2, creates job record in MongoDB, initializes Durable Object status, and starts the Cloudflare Workflow.

## Input
- **HTTP Request**: `POST /jobs` with multipart form data
  - `file`: PDF/Excel/Image file (required)
  - `mode`: `"strict"` | `"best_judgment"` (default: `"strict"`)
  - `options`: JSON string with optional overrides for LLM providers/models

## Processing
1. Parse multipart body, validate `file` and `mode`
2. Generate `jobId` (UUID)
3. Compute `fileHashSha256` for DI cache key
4. Upload file to R2 at `uploads/{jobId}/{filename}`
5. Create job record in MongoDB `jobs` collection:
   ```json
   {
     "jobId": "...",
     "mode": "strict",
     "state": "queued",
     "filename": "...",
     "contentType": "...",
     "sizeBytes": 12345,
     "fileHashSha256": "abc123...",
     "r2UploadKey": "uploads/{jobId}/{filename}",
     "r2ArtifactsPrefix": "artifacts/{jobId}/",
     "createdAt": "2025-...",
     "updatedAt": "2025-...",
     "options": {}
   }
   ```
6. Initialize Durable Object status via `initStatus(env, jobId)`
7. Start workflow via `env.WBS_WORKFLOW.start({ params: { jobId } })`

## Output
- **HTTP Response**: `202 Accepted`
  ```json
  { "jobId": "uuid-here" }
  ```

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `uploads/{jobId}/{filename}` | Original uploaded file |

## Logging
```json
{"ts":"...","level":"info","msg":"ingest_start","scope":"route:POST /jobs","jobId":"...","filename":"...","sizeBytes":12345,"contentType":"...","mode":"strict"}
{"ts":"...","level":"info","msg":"workflow_starting","scope":"route:POST /jobs","jobId":"..."}
```

## Errors
- `400` if file missing or invalid mode
- Workflow start failures logged but job still returned (user can poll status)
