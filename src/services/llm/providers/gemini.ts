import type { LlmConfig, LlmMessage } from "../llmClient";

export async function chatGemini(env: Env, cfg: LlmConfig, messages: LlmMessage[]) {

  // Use Google Generative Language API (Gemini) style.
  // This is a placeholder; adjust endpoint/model naming as needed.
  const system = messages.find(m => m.role === "system")?.content ?? "";
  const user = messages.filter(m => m.role === "user").map(m => m.content).join("\n\n");

  const res = await fetch(`https://gateway.ai.cloudflare.com/v1/004dc1af737b22a8aa83b3550fa9b9d3/wbs-agent-test/google-ai-studio/v1/models/${cfg.model}:generateContent?key=${env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-aig-authorization": `Bearer ${env.CF_GATEWAY_KEY}`
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: system + "\n\n" + user }] }],
      generationConfig: { temperature: cfg.temperature ?? 0.2 }
    })
  });

  if (!res.ok) throw new Error(`Gemini failed: ${res.status} ${await res.text()}`);
  const data: any = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
}
