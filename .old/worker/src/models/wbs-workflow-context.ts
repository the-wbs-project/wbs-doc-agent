import type { AiModelProvider } from "../services/llm/models";
import type { JobRecord } from "./job";
import type { SiteAiConfig, SiteConfig } from "./site-config";

export interface WbsWorkflowAiConfig extends SiteAiConfig {
    globalProvider: AiModelProvider;
    globalModel: string;
    extractProvider: AiModelProvider;
    extractModel: string;
    verifyProvider: AiModelProvider;
    verifyModel: string;
    judgeProvider: AiModelProvider;
    judgeModel: string;
    summaryProvider: AiModelProvider;
    summaryModel: string;
}

export interface WbsWorkflowContext extends SiteConfig {
    //env: Env;
    job: JobRecord;
    docIntel: {
        cacheKey: string;
        cacheTtlSeconds: number;
        cacheEnabled: boolean;
    },
    ai: WbsWorkflowAiConfig;
}