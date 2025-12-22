import type { AiModelProvider } from "../services/llm/models";
import type { Logger } from "../services/logger";
import type { Repositories } from "../services/mongo/repositories";
import type { JobRecord } from "./job";

export interface WbsWorkflowContext {
    env: Env;
    jobId: string;
    job: JobRecord;
    logger: Logger;
    repos: Repositories;
    config: {
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
        diCacheKey: string;
        diCacheTtlSeconds: number;
        diCacheEnabled: boolean;
    }
}