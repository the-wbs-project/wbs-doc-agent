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

    // Handle WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.state.acceptWebSocket(server);

      // Send current status immediately on connect
      const status = await this.state.storage.get<JobStatus>("status");
      if (status) {
        server.send(JSON.stringify(status));
      }

      return new Response(null, { status: 101, webSocket: client });
    }

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
      this.broadcast(status);
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
      this.broadcast(next);
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
      this.broadcast(status);
      return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
    }

    return new Response("Not found", { status: 404 });
  }

  /** Broadcast status to all connected WebSocket clients */
  private broadcast(status: JobStatus) {
    const sockets = this.state.getWebSockets();
    const payload = JSON.stringify(status);
    for (const ws of sockets) {
      try {
        ws.send(payload);
      } catch {
        // Socket may be closed, ignore
      }
    }
  }

  /** Handle WebSocket close - required for Hibernatable WebSockets */
  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    // Nothing to clean up - DO handles socket lifecycle
  }

  /** Handle WebSocket error - required for Hibernatable WebSockets */
  webSocketError(ws: WebSocket, error: unknown) {
    this.log.error("websocket_error", { error: String(error) });
  }
}
