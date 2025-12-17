# Step 10: Progress Tracking

## Overview
Durable Object (`JobStatusDO`) stores real-time job status. Clients poll `GET /jobs/:id/status`.

## Durable Object: `JobStatusDO`

### Storage Schema
```typescript
{
  jobId: string,
  state: "queued" | "running" | "completed" | "failed",
  step: string,
  percent: number,        // 0-100
  messages: Array<{
    ts: string,
    level: "info" | "warn" | "error",
    msg: string,
    data?: any
  }>,
  errors: Array<{
    ts: string,
    msg: string,
    data?: any
  }>,
  updatedAt: string
}
```

### HTTP Endpoints (internal, called via stub)
| Path | Method | Description |
|------|--------|-------------|
| `/status/init` | POST | Initialize new job status |
| `/status/set` | POST | Update fields (state, step, percent, message) |
| `/status/append` | POST | Append message/error to arrays |
| `/status/get` | GET | Read current status |

## Client Functions (`statusClient.ts`)

### `initStatus(env, jobId)`
Creates initial status record with `state: "queued"`.

### `setStatus(env, jobId, patch)`
Updates status fields. If `patch.message` provided, appends to messages array.

### `appendStatus(env, jobId, level, msg, data?)`
Appends message to array. If `level === "error"`, also appends to errors array.

### `getStatus(env, jobId)`
Returns full status object.

## API Route
```
GET /jobs/:jobId/status
```

Returns current status from DO:
```json
{
  "jobId": "...",
  "state": "running",
  "step": "extract_regions",
  "percent": 45,
  "messages": [...],
  "errors": [],
  "updatedAt": "2025-..."
}
```

## Workflow Status Updates

| Step | Percent | Step Name |
|------|---------|-----------|
| Start | 2 | `start` |
| DI Cache Check | 8 | `di` |
| Normalize/Segment | 20 | `segment` |
| Extract Regions | 30-55 | `extract_regions` |
| Validate | 60 | `validate` |
| Consolidate | 65 | `consolidate` |
| Verify | 75 | `verify` |
| Escalate (if needed) | 82 | `escalate` |
| Persist | 92 | `persist` |
| Summary | 96 | `summary` |
| Complete | 100 | `done` |

## Error Handling
On workflow failure:
1. Append error message to DO
2. Set `state: "failed"`, `step: "failed"`, `percent: 100`
3. Best-effort update MongoDB job record

## Polling Pattern
```javascript
async function pollUntilDone(jobId) {
  while (true) {
    const status = await fetch(`/jobs/${jobId}/status`).then(r => r.json());
    console.log(`${status.step}: ${status.percent}%`);
    
    if (status.state === "completed" || status.state === "failed") {
      return status;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
}
```

## Wrangler Config
```jsonc
"durable_objects": {
  "bindings": [{ "name": "JOB_STATUS_DO", "class_name": "JobStatusDO" }]
}
```

## Notes
- DO provides strong consistency for status reads
- Messages array provides audit trail
- Errors array enables quick error inspection
- Percent increments correlate with pipeline stage
