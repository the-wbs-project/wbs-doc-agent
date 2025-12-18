import { putR2Object } from "./r2Service";

export async function putArtifactJson(env: Env, jobId: string, relativeKey: string, data: any) {
  const key = `artifacts/${jobId}/${relativeKey}`;
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2)).buffer as ArrayBuffer;
  await putR2Object(env, key, bytes, "application/json");
  return key;
}

export async function putArtifactText(env: Env, jobId: string, relativeKey: string, text: string) {
  const key = `artifacts/${jobId}/${relativeKey}`;
  const bytes = new TextEncoder().encode(text).buffer as ArrayBuffer;
  await putR2Object(env, key, bytes, "text/plain; charset=utf-8");
  return key;
}
