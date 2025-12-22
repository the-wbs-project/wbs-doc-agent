declare type StatusContext = { env: Env; jobId: string };

export function getStatusStub(ctx: StatusContext) {
  const id = ctx.env.JOB_STATUS_DO.idFromName(ctx.jobId);

  return ctx.env.JOB_STATUS_DO.get(id);
}

export async function initStatus(ctx: StatusContext) {
  const stub = getStatusStub(ctx);

  await stub.fetch("https://do/status/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId: ctx.jobId })
  });
}

export async function setStatus(ctx: StatusContext, patch: Record<string, unknown>) {
  const stub = getStatusStub(ctx);

  await stub.fetch("https://do/status/set", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId: ctx.jobId, ...patch })
  });
}

export async function appendStatus(ctx: StatusContext, level: "info" | "warn" | "error", msg: string, data?: any) {
  const stub = getStatusStub(ctx);

  await stub.fetch("https://do/status/append", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ level, msg, data })
  });
}

export async function getStatus(ctx: StatusContext) {
  const stub = getStatusStub(ctx);
  const res = await stub.fetch("https://do/status/get");

  if (!res.ok) throw new Error(`Status get failed: ${res.status}`);

  return await res.json();
}
