import { Hono } from "hono";
import { cors } from "hono/cors";
import { sendAnswer, startWorkflow } from "./n8n";
import type { StatusUpdate, Question, Answer } from "./types";

// Re-export for wrangler
export { JobDO } from "./job-do";

const app = new Hono<{ Bindings: Env }>();



app.use('/api/*', async (c, next) => {
  const token = c.env.AUTH_TOKEN;
  const providedToken = c.req.header('X-Auth-Token');

  if (providedToken !== token) {
      return c.json({ error: 'Unauthorized' }, 401);
  }

  await next();
});

// CORS for all API routes
app.use("/api/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

// Health check
app.get("/", (c) => c.text("wbs-worker2 OK"));

// Generate a unique job ID
function generateJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `job_${timestamp}_${random}`;
}

// Get DO stub for a job
function getJobDO(env: Env, jobId: string) {
  const id = env.JOB_DO.idFromName(jobId);
  return env.JOB_DO.get(id);
}

// ============== UPLOAD ==============
app.post("/api/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"] as File | undefined;
  const userContext = (body["userContext"] as string | undefined) ?? "";
  const useTestWorkflow = (body["useTestWorkflow"] as string | undefined) !== "false";

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  const jobId = generateJobId();
  const fileKey = `${jobId}/artifacts/${file.name}`;

  // Store file in R2
  const arrayBuffer = await file.arrayBuffer();
  await c.env.BUCKET.put(fileKey, arrayBuffer, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  // Initialize the Durable Object
  const stub = getJobDO(c.env, jobId);
  await stub.init(jobId, file.name);

  // Trigger n8n workflow
  await startWorkflow(c.env, { jobId, fileName: file.name, userContext, useTestWorkflow });

  return c.json({ jobId, fileKey });
});

// ============== JOB STATE ==============
app.get("/api/jobs/:id", async (c) => {
  const jobId = c.req.param("id");
  const stub = getJobDO(c.env, jobId);
  const data = await stub.getState();

  if (!data) {
    return c.json({ error: "not_found" }, 404);
  }
  return c.json(data);
});//

// WebSocket connection
app.get("/api/jobs/:id/ws", async (c) => {
  const jobId = c.req.param("id");
  const stub = getJobDO(c.env, jobId);
  return stub.fetch(c.req.raw);
});

// ============== n8n → Worker ==============
app.post("/api/jobs/:id/status", async (c) => {
  const jobId = c.req.param("id");
  const stub = getJobDO(c.env, jobId);
  const update = await c.req.json<StatusUpdate>();

  try {
    const result = await stub.pushStatus(update);
    return c.json(result);
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

app.post("/api/jobs/:id/question", async (c) => {
  const jobId = c.req.param("id");
  const stub = getJobDO(c.env, jobId);
  const question = await c.req.json<Omit<Question, "askedAt">>();

  try {
    const result = await stub.askQuestion(question);
    return c.json(result);
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

app.post("/api/jobs/:id/artifacts/:name", async (c) => {
  const jobId = c.req.param("id");
  const name = c.req.param("name");
  const stub = getJobDO(c.env, jobId);
  const body = await c.req.arrayBuffer();
  const contentType = c.req.header("Content-Type") || "application/octet-stream";

  try {
    const result = await stub.uploadArtifact(name, body, contentType);
    return c.json(result);
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

// Bulk upload multiple artifacts
app.post("/api/jobs/:id/artifacts", async (c) => {
  const jobId = c.req.param("id");
  const stub = getJobDO(c.env, jobId);

  try {
    const files = await c.req.json<{ filename: string; mimeType: string; body: string | number[] }[]>();

    if (!Array.isArray(files)) {
      return c.json({ error: "Body must be an array of files" }, 400);
    }

    const results: { filename: string; status: string; error?: string }[] = [];
    const uploadPromises: Promise<void>[] = [];

    for (const file of files) {
      if (!file.filename || !file.mimeType || file.body === undefined) {
        results.push({ filename: file.filename || "unknown", status: "skipped", error: "Missing required fields" });
        continue;
      }

      let content: ArrayBuffer;
      if (Array.isArray(file.body)) {
        content = new Uint8Array(file.body).buffer;
      } else {
        content = new TextEncoder().encode(file.body).buffer;
      }

      uploadPromises.push(
        stub.uploadArtifact(file.filename, content, file.mimeType).then(() => {
          results.push({ filename: file.filename, status: "uploaded" });
        }).catch((e) => {
          results.push({ filename: file.filename, status: "failed", error: String(e) });
        })
      );
    }

    await Promise.all(uploadPromises);

    return c.json({ message: "Bulk upload processed", results });
  } catch (e) {
    return c.json({ error: "Invalid JSON or upload failed", details: String(e) }, 400);
  }
});

// ============== Site → Worker ==============
app.post("/api/jobs/:id/answer", async (c) => {
  const jobId = c.req.param("id");
  const stub = getJobDO(c.env, jobId);
  const answer = await c.req.json<Answer>();

  try {
    const result = await stub.submitAnswer(answer);

    // Forward answer to n8n
    await sendAnswer(c.env, {
      jobId,
      questionId: answer.questionId,
      answer: answer.answer,
    });

    return c.json(result);
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

// ============== ARTIFACTS ==============
app.get("/api/jobs/:id/artifacts", async (c) => {
  const jobId = c.req.param("id");
  const stub = getJobDO(c.env, jobId);

  try {
    const artifacts = await stub.listArtifacts();
    return c.json({ artifacts });
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

app.get("/api/jobs/:id/artifacts/:name", async (c) => {
  const jobId = c.req.param("id");
  const name = c.req.param("name");
  const stub = getJobDO(c.env, jobId);

  try {
    const artifact = await stub.getArtifact(name);
    if (!artifact) {
      return c.json({ error: "artifact_not_found" }, 404);
    }

    return new Response(artifact.body, {
      headers: { "Content-Type": artifact.contentType },
    });
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
