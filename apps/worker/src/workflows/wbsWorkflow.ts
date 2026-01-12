import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Region } from "../models/regions";
import type { WbsNode } from "../models/wbs";
import { createLogger } from "../services/logger";
import { Repositories } from "../services/d1/repositories";
import { appendStatus, setStatus } from "../status/statusClient";
import { consolidateStep } from "./wbs-steps/consolidate";
import { diCheckCacheAndCall } from "./wbs-steps/di-check-cache-and-call";
import { diStatusUpdate } from "./wbs-steps/di-status-update";
import { diStoreArtifact } from "./wbs-steps/di-store-artifact";
import { escalateStatusStep, escalateExtractStep, escalateJudgeStep, getEscalateConfig, mergeEscalatedNodes } from "./wbs-steps/escalate";
import { extractBatchStep } from "./wbs-steps/extract-batch";
import { extractStatusUpdateStep } from "./wbs-steps/extract-status-update";
import { generateSummaryStep } from "./wbs-steps/generate-summary";
import { getContext } from "./wbs-steps/get-context";
import { globalAnalysisStep } from "./wbs-steps/global-analysis";
import { markCompletedStep } from "./wbs-steps/mark-completed";
import { markRunning } from "./wbs-steps/mark-running";
import { normalizeSegment } from "./wbs-steps/normalize-segment";
import { persistNodesStep } from "./wbs-steps/persist-nodes";
import { storeFinalStep } from "./wbs-steps/store-final";
import { validateStep } from "./wbs-steps/validate";
import { verifyStep } from "./wbs-steps/verify";

type Params = { jobId: string };

export class WbsWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    console.log("RUNNING!");
    const { jobId } = event.payload;
    const log = createLogger({ jobId, scope: "workflow" });
    const env = this.env;
    const repos = Repositories.create(env);

    try {
      // Get config
      const ctx = await step.do("get-config", async () => { return getContext(env, jobId, log, repos); });

      // Mark job running
      await step.do("mark-running", () => markRunning(ctx, env, log, repos));

      // --- Step 02: DI with cache ---
      await step.do("di-status-update", () => diStatusUpdate(ctx, env, log));

      // Check DI cache and call backend if needed
      const { diRaw, cacheHit } = await step.do("di-check-cache-and-call", () => diCheckCacheAndCall(ctx, env, log));

      // Store DI artifact
      await step.do("di-store-artifact", () => diStoreArtifact(ctx, env, diRaw, cacheHit, repos, log));

      // --- Step 03 normalize + segment ---
      const { diNormalized, regions } = await step.do("normalize-segment", () => normalizeSegment(ctx, env, diRaw, log));

      // --- Step 03b: Global Document Analysis ---
      const globalAnalysis = await step.do("global-analysis", () => globalAnalysisStep(ctx, env, diNormalized, regions, log));

      await step.do("extract-status-update", () => extractStatusUpdateStep(ctx, env, regions, log));

      // --- Step 04 extract ---
      // Extract regions in parallel batches of 3 for better performance
      const extractedNodes: WbsNode[] = [];
      const BATCH_SIZE = 3;
      const regionBatches: Region[][] = [];

      for (let i = 0; i < regions.length; i += BATCH_SIZE) {
        regionBatches.push(regions.slice(i, i + BATCH_SIZE));
      }

      for (let batchIdx = 0; batchIdx < regionBatches.length; batchIdx++) {
        const batch = regionBatches[batchIdx];
        const batchStartIdx = batchIdx * BATCH_SIZE;
        const batchNodes = await step.do(`extract-batch`, () => extractBatchStep(ctx, env, batch, batchStartIdx, regions, globalAnalysis, log));

        extractedNodes.push(...batchNodes);
      }

      // --- Step 05 validate ---
      const validationReport = await step.do("validate", () => validateStep(ctx, env, extractedNodes, regions, log));

      // --- Step 06 consolidate ---
      const draftNodes = await step.do("consolidate", () => consolidateStep(ctx, env, extractedNodes, log));

      // --- Step 07 verify ---

      const verifyOut = await step.do("verify", () => verifyStep(ctx, env, draftNodes, validationReport, regions, log));

      let finalNodes = verifyOut.correctedNodes;

      // --- Step 08 escalate if needed ---
      if (verifyOut.escalationPlan?.needed) {
        const targetRegionIds = await step.do("escalate-status", () => escalateStatusStep(ctx, env, verifyOut, log));

        const regionMap = new Map(regions.map(r => [r.regionId, r]));
        const escalateConfig = getEscalateConfig(ctx);
        const patches: Record<string, WbsNode[]> = {};

        for (const regionId of targetRegionIds) {
          const region = regionMap.get(regionId);
          if (!region) continue;

          const candidates = await step.do(`escalate-extract-${regionId}`, () =>
            escalateExtractStep(ctx, region, escalateConfig, log)
          );

          const nodes = await step.do(`escalate-judge-${regionId}`, () =>
            escalateJudgeStep(ctx, env, region, candidates, escalateConfig, log)
          );
          patches[regionId] = nodes;
        }

        finalNodes = mergeEscalatedNodes(verifyOut, targetRegionIds, patches);
      }

      await step.do("store-final", () => storeFinalStep(ctx, env, finalNodes, log));

      // --- Step 09 persist + summary ---
      await step.do("persist-nodes", () => persistNodesStep(ctx, env, finalNodes, log, repos));

      // --- Step 10 generate summary ---
      await step.do("generate-summary", () => generateSummaryStep(ctx, env, finalNodes, validationReport, verifyOut.issues ?? [], log));

      // Mark completed
      await step.do("mark-completed", () => markCompletedStep(ctx, env, finalNodes, validationReport, log, repos));

    } catch (err: any) {
      console.log("IN FAILED STATE!");

      const msg = err?.message ?? String(err);
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: "error", jobId, msg, stack: err?.stack }));

      await appendStatus(jobId, env.JOB_STATUS_DO, "error", "Job failed", { error: msg });
      await setStatus(jobId, env.JOB_STATUS_DO, { state: "failed", step: "failed", percent: 100, message: "Failed" });

      // best-effort mark in mongo
      try {
        await repos.jobs.markFailed(jobId, msg);
      } catch {
        /* ignore */
      }
      throw err;
    }
  }
}
