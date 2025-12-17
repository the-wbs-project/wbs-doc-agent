import { Hono } from "hono";
import type { JobMode, JobRecord } from "../models/job";
import { sha256Hex } from "../services/hash";
import { uuid } from "../services/id";
import { createLogger } from "../services/logger";
import { mongoDataApi } from "../services/mongo/mongoDataApiClient";
import * as jobsRepo from "../services/mongo/repositories/jobsRepo";
import { putR2Object } from "../services/r2Service";
import { nowIso } from "../services/time";
import { getStatus, initStatus } from "../status/statusClient";

export const jobsRoute = new Hono<{ Bindings: Env }>();

jobsRoute.post("/jobs", async (c) => {
  const log = createLogger({ scope: "route:POST /jobs" });

  const body = await c.req.parseBody();
  const file = body["file"] as File | undefined;
  const mode = (body["mode"] as string | undefined) ?? "strict";
  const optionsRaw = body["options"] as string | undefined;

  if (!file) return c.json({ error: "file_required" }, 400);
  if (mode !== "strict" && mode !== "best_judgment") return c.json({ error: "invalid_mode" }, 400);

  const jobId = uuid();
  const filename = file.name || "upload";
  const contentType = file.type || "application/octet-stream";
  const bytes = await file.arrayBuffer();
  const sizeBytes = bytes.byteLength;

  const fileHashSha256 = await sha256Hex(bytes);
  const r2UploadKey = `uploads/${jobId}/${filename}`;
  const r2ArtifactsPrefix = `artifacts/${jobId}/`;

  log.info("ingest_start", { jobId, filename, sizeBytes, contentType, mode });

  await putR2Object(c.env, r2UploadKey, bytes, contentType);

  const job: JobRecord = {
    jobId,
    mode: mode as JobMode,
    state: "queued",
    filename,
    contentType,
    sizeBytes,
    fileHashSha256,
    r2UploadKey,
    r2ArtifactsPrefix,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    options: optionsRaw ? JSON.parse(optionsRaw) : {}
  };

  await jobsRepo.createJob(c.env, job);
  await initStatus(c.env, jobId);

  // Start workflow
  try {
    log.info("workflow_starting", { jobId });
    await c.env.WBS_WORKFLOW.create({ id: jobId, params: { jobId } });
  } catch (e: any) {
    log.error("workflow_start_failed", { jobId, error: e?.message ?? String(e) });
    // still return jobId; user can inspect status
  }

  return c.json({ jobId }, 202);
});

jobsRoute.get("/jobs/:jobId/status", async (c) => {
  const jobId = c.req.param("jobId");
  const status = await getStatus(c.env, jobId);
  return c.json(status);
});

jobsRoute.get("/jobs/:jobId/result", async (c) => {
  const jobId = c.req.param("jobId");
  const jobRes = await mongoDataApi.findOne(c.env, c.env.MONGO_COLL_JOBS, { jobId }) as { document: any };
  if (!jobRes.document) return c.json({ error: "not_found" }, 404);

  const job = jobRes.document;
  if (job.state !== "completed") return c.json({ error: "not_completed", state: job.state }, 409);

  // Fetch nodes from MongoDB
  const nodesRes = await mongoDataApi.find(c.env, c.env.MONGO_COLL_NODES, { jobId }) as { documents: any[] };
  const nodes = nodesRes.documents ?? [];

  return c.json({
    jobId,
    mode: job.mode,
    summary: job.summary ?? null,
    qc: {
      nodeCount: job.nodeCount,
      inferredCount: job.inferredCount,
      coverageRatio: job.coverageRatio
    },
    nodes,
    artifacts: { r2Prefix: job.r2ArtifactsPrefix }
  });
});
