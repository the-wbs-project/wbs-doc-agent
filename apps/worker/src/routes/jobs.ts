import { Hono } from "hono";
import type { JobMode, JobRecord } from "../models/job";
import { sha256Hex } from "../services/hash";
import { uuid } from "../services/id";
import { createLogger } from "../services/logger";
import { Repositories } from "../services/d1/repositories";
import { putR2Object } from "../services/r2Service";
import { nowIso } from "../services/time";
import { getStatus, initStatus } from "../status/statusClient";

export const jobsRoute = new Hono<{ Bindings: Env }>();

jobsRoute.post("/", async (c) => {
    const log = createLogger({ scope: "route:POST /jobs" });
    const jobId = uuid();
    const repos = Repositories.create(c.env);

    try {
        const body = await c.req.parseBody();
        const file = body["file"] as File | undefined;
        const mode = (body["mode"] as string | undefined) ?? "strict";
        const optionsRaw = body["options"] as string | undefined;

        if (!file) return c.json({ error: "file_required" }, 400);
        if (mode !== "strict" && mode !== "best_judgment") return c.json({ error: "invalid_mode" }, 400);

        const filename = file.name || "upload";
        const contentType = file.type || "application/octet-stream";
        const bytes = await file.arrayBuffer();
        const sizeBytes = bytes.byteLength;

        const fileHashSha256 = await sha256Hex(bytes);
        const r2UploadKey = `uploads/${jobId}/${filename}`;
        const r2ArtifactsPrefix = `artifacts/${jobId}/`;

        log.info("ingest_start", { jobId, filename, sizeBytes, contentType, mode });

        await putR2Object(c.env.UPLOADS_R2, r2UploadKey, bytes, contentType);

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
            options: optionsRaw ? JSON.parse(optionsRaw) : {},
        };

        await repos.jobs.create(job);
        await initStatus(jobId, c.env.JOB_STATUS_DO);

        log.info("workflow_starting", { jobId });

        await c.env.WBS_WORKFLOW.create({ id: jobId, params: { jobId } });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        log.error("workflow_start_failed", { jobId, error: msg });
    }

    return c.json({ jobId }, 202);
});

jobsRoute.get("/:jobId/status", async (c) => {
    const jobId = c.req.param("jobId");
    const status = await getStatus(jobId, c.env.JOB_STATUS_DO);
    return c.json(status);
});

jobsRoute.get("/:jobId/ws", async (c) => {
    const jobId = c.req.param("jobId");
    const stub = c.env.JOB_STATUS_DO.get(c.env.JOB_STATUS_DO.idFromName(jobId));
    return stub.fetch(c.req.raw);
});

jobsRoute.get("/:jobId/result", async (c) => {
    const jobId = c.req.param("jobId");
    const repos = Repositories.create(c.env);

    let job: JobRecord;
    try {
        job = await repos.jobs.get(jobId);
    } catch {
        return c.json({ error: "not_found" }, 404);
    }

    if (job.state !== "completed") return c.json({ error: "not_completed", state: job.state }, 409);

    const nodes = await repos.nodes.getForJob(jobId);

    return c.json({
        jobId,
        mode: job.mode,
        summary: (job as JobRecord & { summary?: string }).summary ?? null,
        qc: {
            nodeCount: job.nodeCount,
            inferredCount: job.inferredCount,
            coverageRatio: job.coverageRatio,
        },
        nodes,
        artifacts: { r2Prefix: job.r2ArtifactsPrefix },
    });
});

jobsRoute.get("/:jobId/artifacts", async (c) => {
    const jobId = c.req.param("jobId");
    const prefix = `artifacts/${jobId}/`;

    const listed = await c.env.UPLOADS_R2.list({ prefix });

    const artifacts = listed.objects.map((obj) => ({
        key: obj.key.replace(prefix, ""),
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
    }));

    return c.json({ artifacts });
});

jobsRoute.get("/:jobId/artifacts/*", async (c) => {
    const jobId = c.req.param("jobId");
    const artifactPath = c.req.path.split(`/${jobId}/artifacts/`)[1];
    if (!artifactPath) return c.json({ error: "artifact_path_required" }, 400);

    const key = `artifacts/${jobId}/${artifactPath}`;
    const obj = await c.env.UPLOADS_R2.get(key);

    if (!obj) return c.json({ error: "not_found" }, 404);

    const content = await obj.text();

    // Try to parse as JSON, otherwise return as text
    try {
        const json = JSON.parse(content);
        return c.json(json);
    } catch {
        return c.text(content);
    }
});
