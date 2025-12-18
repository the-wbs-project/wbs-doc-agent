export function getStatusStub(env: Env, jobId: string) {
  const id = env.JOB_STATUS_DO.idFromName(jobId);
  return env.JOB_STATUS_DO.get(id);
}

export async function initStatus(env: Env, jobId: string) {
  const stub = getStatusStub(env, jobId);
  await stub.fetch("https://do/status/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId })
  });
}

export async function setStatus(env: Env, jobId: string, patch: any) {
  const stub = getStatusStub(env, jobId);
  await stub.fetch("https://do/status/set", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId, ...patch })
  });
}

export async function appendStatus(env: Env, jobId: string, level: "info" | "warn" | "error", msg: string, data?: any) {
  const stub = getStatusStub(env, jobId);
  await stub.fetch("https://do/status/append", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ level, msg, data })
  });
}

export async function getStatus(env: Env, jobId: string) {
  const stub = getStatusStub(env, jobId);
  const res = await stub.fetch("https://do/status/get");
  if (!res.ok) throw new Error(`Status get failed: ${res.status}`);
  return await res.json();
}
