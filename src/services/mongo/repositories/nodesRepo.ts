import type { WbsNode } from "../../../models/wbs";
import { mongoDataApi } from "../mongoDataApiClient";

export async function replaceNodesForJob(env: Env, jobId: string, nodes: WbsNode[]) {
  await mongoDataApi.deleteMany(env, env.MONGO_COLL_NODES, { jobId });
  if (nodes.length) await mongoDataApi.insertMany(env, env.MONGO_COLL_NODES, nodes);
}
