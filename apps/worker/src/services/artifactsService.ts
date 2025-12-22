import type { WbsWorkflowContext } from "../models/wbs-workflow-context";
import { putR2Object } from "./r2Service";

export async function putArtifactJson(ctx: WbsWorkflowContext, relativeKey: string, data: any) {
  const key = `artifacts/${ctx.jobId}/${relativeKey}`;
  const bytes = new TextEncoder().encode(JSON.stringify(data, null, 2)).buffer as ArrayBuffer;

  await putR2Object(ctx.env, key, bytes, "application/json");

  return key;
}

export async function putArtifactText(ctx: WbsWorkflowContext, relativeKey: string, text: string) {
  const key = `artifacts/${ctx.jobId}/${relativeKey}`;
  const bytes = new TextEncoder().encode(text).buffer as ArrayBuffer;
  await putR2Object(ctx.env, key, bytes, "text/plain; charset=utf-8");
  return key;
}
