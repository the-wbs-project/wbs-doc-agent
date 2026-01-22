export function diCacheKey(fileHash: string, diModel: string, diBackendVersion: string) {
  return `di:${fileHash}:${diModel}:${diBackendVersion}`;
}

export async function kvGetJson(diKV: KVNamespace, key: string) {
  const txt = await diKV.get(key);
  if (!txt) return null;
  return JSON.parse(txt);
}

export async function kvPutJson(diKV: KVNamespace, key: string, value: any, ttlSeconds: number) {
  await diKV.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
}