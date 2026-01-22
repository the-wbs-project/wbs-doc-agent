/**
 * Stub client for n8n webhook calls.
 * Replace URLs in wrangler.jsonc when real n8n is available.
 */

export interface N8nStartPayload {
  jobId: string;
  fileName: string;
  userContext: string;
  useTestWorkflow: boolean;
}

export interface N8nAnswerPayload {
  jobId: string;
  questionId: string;
  answer: unknown;
}

export async function startWorkflow(env: Env, payload: N8nStartPayload): Promise<{ ok: boolean }> {
  const workflowUrl = payload.useTestWorkflow ? env.N8N_WORKFLOW_URL_TEST : env.N8N_WORKFLOW_URL_PROD;
  console.log(`[n8n] Starting ${payload.useTestWorkflow ? "test" : "production"} workflow:`, payload);

  const response = await fetch(workflowUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function sendAnswer(env: Env, payload: N8nAnswerPayload): Promise<{ ok: boolean }> {
  console.log("[n8n stub] Sending answer:", payload);

  // In production, this would POST to the n8n answer webhook
  // const response = await fetch(env.N8N_ANSWER_URL, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(payload),
  // });
  // return response.json();

  // Stub: just log and return success
  return { ok: true };
}
