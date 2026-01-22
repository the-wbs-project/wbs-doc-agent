import { DurableObject } from "cloudflare:workers";
import type { JobData, StatusUpdate, Question, Answer } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * JobDO - Durable Object that owns all state for a single job.
 * Handles status updates, HITL questions, artifacts, and WebSocket broadcasting.
 * Persists to R2 on every mutation.
 */
export class JobDO extends DurableObject<Env> {
  private jobData: JobData | null = null;

  // Only used for WebSocket upgrades
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    const data = await this.loadJobData();
    if (data) {
      server.send(JSON.stringify(data));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // ============== RPC Methods ==============

  async init(jobId: string, filename: string): Promise<{ ok: true; jobId: string }> {
    const data: JobData = {
      jobId,
      state: "pending",
      step: "initialized",
      percent: 0,
      statuses: [{ step: "initialized", message: `Job created for ${filename}` }],
      questions: [],
      artifacts: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await this.saveJobData(data);
    this.broadcast(data);

    return { ok: true, jobId };
  }

  async getState(): Promise<JobData | null> {
    return this.loadJobData();
  }

  async pushStatus(update: StatusUpdate): Promise<{ ok: true }> {
    const data = await this.loadJobData();
    if (!data) throw new Error("Job not initialized");

    data.statuses.push(update);
    data.step = update.step;
    if (update.percent !== undefined) data.percent = update.percent;
    if (update.state) data.state = update.state;
    data.updatedAt = nowIso();

    await this.saveJobData(data);
    await this.persistStatusToR2(data);
    this.broadcast(data);

    return { ok: true };
  }

  async askQuestion(q: Omit<Question, "askedAt">): Promise<{ ok: true; questionId: string }> {
    const data = await this.loadJobData();
    if (!data) throw new Error("Job not initialized");

    const question: Question = {
      ...q,
      askedAt: nowIso(),
    };

    data.questions.push(question);
    data.state = "awaiting_input";
    data.updatedAt = nowIso();

    await this.saveJobData(data);
    await this.persistQuestionsToR2(data);
    this.broadcast(data);

    return { ok: true, questionId: question.id };
  }

  async submitAnswer(answer: Answer): Promise<{ ok: true; questionId: string; answer: unknown }> {
    const data = await this.loadJobData();
    if (!data) throw new Error("Job not initialized");

    const question = data.questions.find((q) => q.id === answer.questionId);
    if (!question) throw new Error("Question not found");

    question.answer = answer.answer;
    question.answeredAt = nowIso();
    data.state = "running";
    data.updatedAt = nowIso();

    await this.saveJobData(data);
    await this.persistQuestionsToR2(data);
    this.broadcast(data);

    return { ok: true, questionId: answer.questionId, answer: answer.answer };
  }

  async uploadArtifact(name: string, body: ArrayBuffer, contentType: string): Promise<{ ok: true; key: string }> {
    const data = await this.loadJobData();
    if (!data) throw new Error("Job not initialized");

    const key = `${data.jobId}/artifacts/${name}`;
    await this.env.BUCKET.put(key, body, {
      httpMetadata: { contentType },
    });

    if (!data.artifacts.includes(name)) {
      data.artifacts.push(name);
      data.updatedAt = nowIso();
      await this.saveJobData(data);
      this.broadcast(data);
    }

    return { ok: true, key };
  }

  async getArtifact(name: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
    const data = await this.loadJobData();
    if (!data) throw new Error("Job not initialized");

    const key = `${data.jobId}/artifacts/${name}`;
    const object = await this.env.BUCKET.get(key);

    if (!object) return null;

    return {
      body: await object.arrayBuffer(),
      contentType: object.httpMetadata?.contentType || "application/octet-stream",
    };
  }

  async listArtifacts(): Promise<{ name: string; size: number; uploaded: string }[]> {
    const data = await this.loadJobData();
    if (!data) throw new Error("Job not initialized");

    const prefix = `${data.jobId}/artifacts/`;
    const list = await this.env.BUCKET.list({ prefix });

    return list.objects.map((obj) => ({
      name: obj.key.replace(prefix, ""),
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
    }));
  }

  // ============== Persistence ==============

  private async loadJobData(): Promise<JobData | null> {
    if (this.jobData) return this.jobData;
    const stored = await this.ctx.storage.get<JobData>("job");
    this.jobData = stored ?? null;
    return this.jobData;
  }

  private async saveJobData(data: JobData): Promise<void> {
    this.jobData = data;
    await this.ctx.storage.put("job", data);
  }

  private async persistStatusToR2(data: JobData): Promise<void> {
    const key = `${data.jobId}/status.json`;
    await this.env.BUCKET.put(key, JSON.stringify(data.statuses, null, 2), {
      httpMetadata: { contentType: "application/json" },
    });
  }

  private async persistQuestionsToR2(data: JobData): Promise<void> {
    const key = `${data.jobId}/questions.json`;
    await this.env.BUCKET.put(key, JSON.stringify(data.questions, null, 2), {
      httpMetadata: { contentType: "application/json" },
    });
  }

  // ============== WebSocket ==============

  private broadcast(data: JobData): void {
    const sockets = this.ctx.getWebSockets();
    const payload = JSON.stringify(data);
    for (const ws of sockets) {
      try {
        ws.send(payload);
      } catch {
        // Socket may be closed
      }
    }
  }

  webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): void {}

  webSocketError(_ws: WebSocket, error: unknown): void {
    console.error("WebSocket error:", error);
  }
}
