import type { JobDO } from "./src/job-do";

declare global {
  interface Env {
    // Durable Objects
    JOB_DO: DurableObjectNamespace<JobDO>;

    // R2
    BUCKET: R2Bucket;

    // Environment variables
    AUTH_TOKEN: string;
    AUTH_PASSWORD: string;
    ENVIRONMENT: string;
    N8N_WORKFLOW_URL_TEST: string;
    N8N_WORKFLOW_URL_PROD: string;
    N8N_ANSWER_URL: string;
  }
}

export {};
