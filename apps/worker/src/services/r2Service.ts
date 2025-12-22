export async function putR2Object(r2: R2Bucket, key: string, body: ArrayBuffer, contentType: string) {
  await r2.put(key, body, { httpMetadata: { contentType } });
}

export async function getR2Object(r2: R2Bucket, key: string) {
  const obj = await r2.get(key);
  if (!obj) throw new Error(`R2 object not found: ${key}`);
  return obj;
}
