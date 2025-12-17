import { nowIso } from "../services/time";
import { createLogger } from "../services/logger";

export type StatusLevel = "info" | "warn" | "error";

export type JobStatus = {
  jobId: string;
  state: "queued" | "running" | "completed" | "failed";
  step: string;
  percent: number;
  messages: Array<{ ts: string; level: StatusLevel; msg: string; data?: any }>;
  errors: Array<{ ts: string; msg: string; data?: any }>;
  updatedAt: string;
};

export class JobStatusDO {
  state: DurableObjectState;
  env: any;
  log = createLogger({ scope: "JobStatusDO" });

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && path.endsWith("/get")) {
      const status = await this.state.storage.get<JobStatus>("status");
      if (!status) return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
      return new Response(JSON.stringify(status), { headers: { "content-type": "application/json" } });
    }

    if (request.method === "POST" && path.endsWith("/init")) {
      const body = await request.json() as { jobId: string; mode?: string };
      const status: JobStatus = {
        jobId: body.jobId,
        state: "queued",
        step: "init",
        percent: 0,
        messages: [{ ts: nowIso(), level: "info", msg: "Job initialized" }],
        errors: [],
        updatedAt: nowIso()
      };
      await this.state.storage.put("status", status);
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
    }

    if (request.method === "POST" && path.endsWith("/set")) {
      const patch = await request.json() as Partial<JobStatus> & { message?: string };
      const status = (await this.state.storage.get<JobStatus>("status")) ?? {
        jobId: patch.jobId ?? "unknown",
        state: "queued",
        step: "unknown",
        percent: 0,
        messages: [],
        errors: [],
        updatedAt: nowIso()
      };

      const next: JobStatus = {
        ...status,
        ...patch,
        messages: status.messages,
        errors: status.errors,
        updatedAt: nowIso()
      };

      if (patch.message) next.messages.push({ ts: nowIso(), level: "info", msg: patch.message });

      await this.state.storage.put("status", next);
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
    }

    if (request.method === "POST" && path.endsWith("/append")) {
      const body = await request.json() as { level: StatusLevel; msg: string; data?: any };
      const status = await this.state.storage.get<JobStatus>("status");
      if (!status) return new Response(JSON.stringify({ error: "not_initialized" }), { status: 400 });

      status.messages.push({ ts: nowIso(), level: body.level, msg: body.msg, data: body.data });
      status.updatedAt = nowIso();

      if (body.level === "error") status.errors.push({ ts: nowIso(), msg: body.msg, data: body.data });

      await this.state.storage.put("status", status);
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
    }

    return new Response("Not found", { status: 404 });
  }
}
