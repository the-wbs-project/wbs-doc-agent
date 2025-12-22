import type { SiteConfig } from "../../../models/site-config";
import type { LlmConfig, LlmMessage } from "../llmClient";

//Chat GPT Response Output
declare type ChatGPTResponseOutput = {
  type: "message";
  content: {
    type: "output_text";
    text: string;
  }[];
};

export async function chatOpenAI(siteConfig: SiteConfig, cfg: LlmConfig, messages: LlmMessage[]): Promise<string | undefined> {
  const res = await fetch("https://gateway.ai.cloudflare.com/v1/004dc1af737b22a8aa83b3550fa9b9d3/wbs-agent-test/openai/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Authorization": `Bearer ${siteConfig.ai.openAiKey}`,
      "cf-aig-authorization": `Bearer ${siteConfig.ai.gatewayKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      input: messages,
      max_output_tokens: 64000,
    })
  });
  if (!res.ok) throw new Error(`OpenAI failed: ${res.status} ${await res.text()}`);
  const data: { output: ChatGPTResponseOutput[] } = await res.json();
  return data.output.find(x => x.type === 'message')?.content.find(x => x.type === 'output_text')?.text;
}