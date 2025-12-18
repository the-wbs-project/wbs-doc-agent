import { nowIso } from "../../time";
import { mongoDataApi } from "../mongoDataApiClient";

export async function recordArtifact(env: Env, jobId: string, artifactKey: string, r2Key: string, meta: any = {}) {
  await mongoDataApi.insertOne(env, env.MONGO_COLL_ARTIFACTS, { jobId, artifactKey, r2Key, meta, createdAt: nowIso() });
}
