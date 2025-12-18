import type { JobRecord } from "../../../models/job";
import { nowIso } from "../../time";
import { mongoDataApi } from "../mongoDataApiClient";

export async function createJob(env: Env, job: JobRecord) {
  await mongoDataApi.insertOne(env, env.MONGO_COLL_JOBS, job);
}

export async function getJob(env: Env, jobId: string): Promise<JobRecord> {
  const r = await mongoDataApi.findOne(env, env.MONGO_COLL_JOBS, { jobId }) as { document: JobRecord | null };
  if (!r.document) throw new Error(`Job not found: ${jobId}`);
  return r.document;
}

export async function markRunning(env: Env, jobId: string) {
  await mongoDataApi.updateOne(env, env.MONGO_COLL_JOBS, { jobId }, { "$set": { state: "running", updatedAt: nowIso() } });
}

export async function markFailed(env: Env, jobId: string, error: string) {
  await mongoDataApi.updateOne(env, env.MONGO_COLL_JOBS, { jobId }, { "$set": { state: "failed", updatedAt: nowIso(), error } });
}

export async function markCompleted(env: Env, jobId: string, patch: Partial<JobRecord>) {
  await mongoDataApi.updateOne(env, env.MONGO_COLL_JOBS, { jobId }, { "$set": { ...patch, state: "completed", updatedAt: nowIso() } });
}
