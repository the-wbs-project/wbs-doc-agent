import type { SiteConfig } from "../../../models/site-config";
import type { LlmConfig, LlmMessage } from "../llmClient";

export async function chatGemini(siteConfig: SiteConfig, cfg: LlmConfig, messages: LlmMessage[], metadata: Record<string, string | number>) {

  // Use Google Generative Language API (Gemini) style.
  // This is a placeholder; adjust endpoint/model naming as needed.
  const system = messages.find(m => m.role === "system")?.content ?? "";
  const user = messages.filter(m => m.role === "user").map(m => m.content).join("\n\n");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cf-aig-authorization": `Bearer ${siteConfig.ai.gatewayKey}`,
    "cf-aig-metadata": JSON.stringify(metadata),
    "cf-aig-skip-cache": siteConfig.ai.skipCache ? "true" : "false",
  };
  const version = cfg.model.includes("preview") ? "v1beta" : "v1";
  const res = await fetch(`https://gateway.ai.cloudflare.com/v1/004dc1af737b22a8aa83b3550fa9b9d3/wbs-agent-test/google-ai-studio/${version}/models/${cfg.model}:generateContent?key=${siteConfig.ai.geminiKey}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: system + "\n\n" + user }] }],
      generationConfig: { temperature: cfg.temperature ?? 0.2, maxOutputTokens: 64000 },
    })
  });

  if (!res.ok) throw new Error(`Gemini failed: ${res.status} ${await res.text()}`);
  const data: any = await res.json();

  return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
}
