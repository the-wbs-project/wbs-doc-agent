import { SiteConfig } from "../../models/site-config";
import { extractJsonObject } from "./json";
import { chatAnthropic } from "./providers/anthropic";
import { chatGemini } from "./providers/gemini";
import { chatOpenAI } from "./providers/openai";

export type LlmMessage = { role: "system" | "user"; content: string };

export type LlmConfig = {
  provider: "openai" | "anthropic" | "gemini";
  model: string;
  temperature?: number;
};

export async function generateJson<T>(siteConfig: SiteConfig, cfg: LlmConfig, messages: LlmMessage[]): Promise<{ json: T; rawText: string }> {
  let rawText = "";
  if (cfg.provider === "openai") rawText = await chatOpenAI(siteConfig, cfg, messages) ?? '';
  else if (cfg.provider === "anthropic") rawText = await chatAnthropic(siteConfig, cfg, messages);
  else rawText = await chatGemini(siteConfig, cfg, messages);

  const json = extractJsonObject(rawText) as T;
  return { json, rawText };
}
