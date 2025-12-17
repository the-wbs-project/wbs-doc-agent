async function call(env: Env, path: string, body: any) {
  const url = `${env.MONGO_DATA_API_URL.replace(/\/+$/, "")}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [env.MONGO_DATA_API_KEY_HEADER]: env.MONGO_DATA_API_KEY
    } as any,
    body: JSON.stringify({
      dataSource: env.MONGO_DATA_API_SOURCE,
      database: env.MONGO_DATA_API_DB,
      ...body
    })
  });

  if (!res.ok) throw new Error(`Mongo Data API error ${res.status}: ${await res.text()}`);
  return await res.json();
}

export const mongoDataApi = {
  insertOne: (env: Env, collection: string, document: any) => call(env, "/action/insertOne", { collection, document }),
  updateOne: (env: Env, collection: string, filter: any, update: any, upsert = false) => call(env, "/action/updateOne", { collection, filter, update, upsert }),
  findOne: (env: Env, collection: string, filter: any) => call(env, "/action/findOne", { collection, filter }),
  find: (env: Env, collection: string, filter: any, opts: { sort?: any; limit?: number; skip?: number } = {}) =>
    call(env, "/action/find", { collection, filter, ...opts }),
  deleteMany: (env: Env, collection: string, filter: any) => call(env, "/action/deleteMany", { collection, filter }),
  insertMany: (env: Env, collection: string, documents: any[]) => call(env, "/action/insertMany", { collection, documents })
};
