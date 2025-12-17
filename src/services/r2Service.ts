export async function putR2Object(env: Env, key: string, body: ArrayBuffer, contentType: string) {
  await env.UPLOADS_R2.put(key, body, { httpMetadata: { contentType } });
}

export async function getR2Object(env: Env, key: string) {
  const obj = await env.UPLOADS_R2.get(key);
  if (!obj) throw new Error(`R2 object not found: ${key}`);
  return obj;
}
