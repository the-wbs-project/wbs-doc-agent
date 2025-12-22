import { NonRetryableError } from "cloudflare:workflows";
import type { WbsWorkflowContext } from "../../models/wbs-workflow-context";
import { diCacheKey } from "../../services/kvCacheService";
import { type AiModelProvider, getModel } from "../../services/llm/models";
import type { Logger } from "../../services/logger";
import type { Repositories } from "../../services/mongo/repositories";

export async function getContext(env: Env, jobId: string, logger: Logger, repos: Repositories): Promise<WbsWorkflowContext> {
    logger.info("get-config - starting");

    try {
        const globalProvider = env.LLM_DEFAULT_VERIFY_PROVIDER.split(',') as [AiModelProvider, 'small' | 'large'];
        const extractProvider = env.LLM_DEFAULT_EXTRACT_PROVIDER.split(',') as [AiModelProvider, 'small' | 'large'];
        const verifyProvider = env.LLM_DEFAULT_VERIFY_PROVIDER.split(',') as [AiModelProvider, 'small' | 'large'];
        const judgeProvider = env.LLM_DEFAULT_JUDGE_PROVIDER.split(',') as [AiModelProvider, 'small' | 'large'];
        const summaryProvider = env.LLM_DEFAULT_SUMMARY_PROVIDER.split(',') as [AiModelProvider, 'small' | 'large'];

        const j = await repos.jobs.get(jobId);

        const config: WbsWorkflowContext = {
            env,
            jobId,
            logger,
            repos,
            job: j,
            config: {
                globalProvider: globalProvider[0],
                globalModel: getModel(globalProvider[0], globalProvider[1]),

                extractProvider: extractProvider[0],
                extractModel: getModel(extractProvider[0], extractProvider[1]),

                verifyProvider: verifyProvider[0],
                verifyModel: getModel(verifyProvider[0], verifyProvider[1]),

                judgeProvider: judgeProvider[0],
                judgeModel: getModel(judgeProvider[0], judgeProvider[1]),

                summaryProvider: summaryProvider[0],
                summaryModel: getModel(summaryProvider[0], summaryProvider[1]),

                diCacheKey: diCacheKey(j.fileHashSha256, env.DI_MODEL, env.DI_BACKEND_VERSION),
                diCacheTtlSeconds: parseInt(env.DI_CACHE_TTL_SECONDS, 10),
                diCacheEnabled: env.DI_CACHE_ENABLED === "true",
            }
        };
        logger.info("get-config - done", { config });

        return config;
    }
    catch (error) {
        logger.error("get-config - error", { error });
        throw new NonRetryableError("Failed to get config");
    }
}