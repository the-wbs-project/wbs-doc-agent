export function getStatusStub(jobId: string, durObj: DurableObjectNamespace) {
  return durObj.get(durObj.idFromName(jobId));
}

export async function initStatus(jobId: string, durObj: DurableObjectNamespace) {
  const stub = getStatusStub(jobId, durObj);

  await stub.fetch("https://do/status/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId })
  });
}

export async function setStatus(jobId: string, durObj: DurableObjectNamespace, patch: Record<string, unknown>) {
  const stub = getStatusStub(jobId, durObj);

  await stub.fetch("https://do/status/set", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId, ...patch })
  });
}

export async function appendStatus(jobId: string, durObj: DurableObjectNamespace, level: "info" | "warn" | "error", msg: string, data?: any) {
  const stub = getStatusStub(jobId, durObj);

  await stub.fetch("https://do/status/append", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ level, msg, data })
  });
}

export async function getStatus(jobId: string, durObj: DurableObjectNamespace) {
  const stub = getStatusStub(jobId, durObj);
  const res = await stub.fetch("https://do/status/get");

  if (!res.ok) throw new Error(`Status get failed: ${res.status}`);

  return await res.json();
}
