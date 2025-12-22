import type { SiteConfig } from "../../../models/site-config";
import type { LlmConfig, LlmMessage } from "../llmClient";

export async function chatAnthropic(siteConfig: SiteConfig, cfg: LlmConfig, messages: LlmMessage[]) {
  // Convert system+user into Anthropic messages
  const system = messages.find(m => m.role === "system")?.content ?? "";
  const user = messages.filter(m => m.role === "user").map(m => m.content).join("\n\n");

  const res = await fetch("https://gateway.ai.cloudflare.com/v1/004dc1af737b22a8aa83b3550fa9b9d3/wbs-agent-test/anthropic/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": siteConfig.ai.anthropicKey,
      "cf-aig-authorization": `Bearer ${siteConfig.ai.gatewayKey}`,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 64000,
      temperature: cfg.temperature ?? 0.2,
      system,
      messages: [{ role: "user", content: user }]
    })
  });

  if (!res.ok) throw new Error(`Anthropic failed: ${res.status} ${await res.text()}`);
  const data: any = await res.json();
  const text = data.content?.map((c: any) => c.text).join("") ?? "";
  return text;
}
