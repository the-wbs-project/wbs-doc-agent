# Step 02: Run Azure Document Intelligence with Cache

## Overview
Check KV cache for prior DI results. On miss, generate presigned R2 URL and call DI micro-backend. Store result in R2 and optionally cache in KV.

## Input
- `jobId` from workflow params
- Job record from MongoDB (contains `fileHashSha256`, `r2UploadKey`)
- Environment: `DI_BACKEND_URL`, `DI_MODEL`, `DI_BACKEND_VERSION`, `DI_CACHE_TTL_SECONDS`, `DI_CACHE_ENABLED`

## Cache Key Format
```
di:{fileHashSha256}:{DI_MODEL}:{DI_BACKEND_VERSION}
```

## Processing
1. Build cache key from `fileHashSha256`, `DI_MODEL`, `DI_BACKEND_VERSION`
2. If caching enabled, check `DI_CACHE_KV.get(cacheKey)`
3. **Cache Hit**:
   - Store `di_cached.json` artifact in R2
   - Record artifact pointer in MongoDB
4. **Cache Miss**:
   - Generate presigned R2 GET URL (S3 SigV4) for the uploaded file
   - Call DI backend: `POST {DI_BACKEND_URL}/analyze` with `{ url, model }`
   - Store `di_raw.json` artifact in R2
   - Record artifact pointer in MongoDB
   - If caching enabled, store result in KV with TTL

## Presigned URL Generation
Uses S3 SigV4 signing with:
- `R2_ACCESS_KEY_ID` (secret)
- `R2_SECRET_ACCESS_KEY` (secret)
- `R2_S3_ENDPOINT`, `R2_S3_BUCKET`, `R2_S3_REGION`
- `R2_PRESIGN_TTL_SECONDS`

## Output
- `diRaw`: Raw DI response JSON

## R2 Artifacts
| Key | Description |
|-----|-------------|
| `artifacts/{jobId}/di_raw.json` | Fresh DI backend response |
| `artifacts/{jobId}/di_cached.json` | Cached DI response (on hit) |

## DO Status Updates
- `step: "di"`, `percent: 8`, `message: "Checking DI cache"`
- Append info messages for cache miss, presign, backend call

## Logging
```json
{"ts":"...","level":"info","msg":"di_cache_check","jobId":"...","cacheKey":"...","cacheHit":false}
{"ts":"...","level":"info","msg":"r2_presigned_url_created","jobId":"...","expires":"900"}
{"ts":"...","level":"info","msg":"di_backend_done","jobId":"...","ms":2345}
```

## Errors
- DI backend failure throws, caught at workflow level → job fails
