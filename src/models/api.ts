import type { JobMode } from "./job";

export type CreateJobResponse = { jobId: string };

export type CreateJobOptions = {
  // LLM override knobs - provider
  extractProvider?: "openai" | "anthropic" | "gemini";
  verifyProvider?: "openai" | "anthropic" | "gemini";
  judgeProvider?: "openai" | "anthropic" | "gemini";
  summaryProvider?: "openai" | "anthropic" | "gemini";

  // LLM override knobs - model
  extractModel?: string;
  verifyModel?: string;
  judgeModel?: string;
  summaryModel?: string;

  // caching
  diCacheEnabled?: boolean;
  diCacheTtlSeconds?: number;
};

export type CreateJobRequestMeta = {
  mode: JobMode;
  options?: CreateJobOptions;
};
