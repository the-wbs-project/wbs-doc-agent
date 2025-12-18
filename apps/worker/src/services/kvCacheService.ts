export function diCacheKey(fileHash: string, diModel: string, diBackendVersion: string) {
  return `di:${fileHash}:${diModel}:${diBackendVersion}`;
}

export async function kvGetJson(env: Env, key: string) {
  const txt = await env.DI_CACHE_KV.get(key);
  if (!txt) return null;
  return JSON.parse(txt);
}

export async function kvPutJson(env: Env, key: string, value: any, ttlSeconds: number) {
  await env.DI_CACHE_KV.put(key, JSON.stringify(value), { expirationTtl: ttlSeconds });
}

export function cacheEnabled(env: Env) {
  return env.DI_CACHE_ENABLED === "true";
}

export function cacheTtl(env: Env) {
  return parseInt(env.DI_CACHE_TTL_SECONDS, 10);
}
