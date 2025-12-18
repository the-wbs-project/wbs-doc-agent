import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { WbsNode } from "../models/wbs";
import { putArtifactJson } from "../services/artifactsService";
import { analyzeWithDiBackend } from "../services/azureDiService";
import { consolidate } from "../services/consolidateService";
import { normalizeDi } from "../services/diNormalizeService";
import { escalateAndJudge } from "../services/escalateService";
import { extractRegion } from "../services/extractService";
import { cacheEnabled, cacheTtl, diCacheKey, kvGetJson, kvPutJson } from "../services/kvCacheService";
import { createLogger } from "../services/logger";
import { Repositories } from "../services/mongo/repositories";
import { getR2Object } from "../services/r2Service";
import { segmentDi } from "../services/segmentService";
import { generateSummary } from "../services/summaryService";
import { validateNodes } from "../services/validateService";
import { verifyDocument } from "../services/verifyService";
import { appendStatus, setStatus } from "../status/statusClient";
import { NonRetryableError } from "cloudflare:workflows";
import { getModel } from "../services/llm/models";

type Params = { jobId: string };

export class WbsWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    console.log("RUNNING!");
    const { jobId } = event.payload;
    const log = createLogger({ jobId, scope: "workflow" });
    const env = this.env;
    const repos = await Repositories.create(env);

    try {
      // Mark job running
      await step.do("mark-running", async () => {
        log.info("marking_running - starting step");

        await repos.jobs.markRunning(jobId);

        await setStatus(env, jobId, { state: "running", step: "start", percent: 2, message: "Workflow started" });

        log.info("marking_running - completed step");
      });

      // Load job record
      const job = await step.do("load-job", async () => {
        try {
          log.info("loading_job - starting step");
          const j = await repos.jobs.get(jobId);
          log.info("loaded_job", { mode: j.mode, r2UploadKey: j.r2UploadKey });
          return j;
        }
        catch (error) {
          log.error("loading_job - error", { error });
          throw new NonRetryableError("Job not found");
        }
      });

      // --- Step 02: DI with cache ---
      await step.do("di-status-update", async () => {
        try {
          log.info("di-status-update - starting step");
          await setStatus(env, jobId, { step: "di", percent: 8, message: "Checking DI cache" });
        }
        catch (error) {
          log.error("di-status-update - error", { error });
          throw new NonRetryableError("Failed to update DI status");
        }
      });

      const ck = await step.do('build-cache-key', async () => {
        try {
          log.info("build-cache-key - starting step");
          return diCacheKey(job.fileHashSha256, env.DI_MODEL, env.DI_BACKEND_VERSION);
        }
        catch (error) {
          log.error("build-cache-key - error", { error });
          throw new NonRetryableError("Failed to build cache key");
        }
      });

      const { diRaw, cacheHit } = await step.do("di-check-cache-and-call", async () => {
        try {
          log.info("di-check-cache-and-call - starting step");
          let diRaw: any = null;
          let cacheHit = false;

          if (cacheEnabled(env)) {
            diRaw = await kvGetJson(env, ck);
            cacheHit = !!diRaw;
            log.info("di_cache_check", { cacheKey: ck, cacheHit });
          }

          if (!diRaw) {
            await appendStatus(env, jobId, "info", "DI cache miss; fetching file from R2");
            const fileObj = await getR2Object(env, job.r2UploadKey);
            log.info("r2_file_fetched", { key: job.r2UploadKey });

            await appendStatus(env, jobId, "info", "Calling DI backend");
            const t0 = Date.now();
            diRaw = await analyzeWithDiBackend(env, {
              fileObj,
              fileKey: job.r2UploadKey,
            });
            log.info("di_backend_done", { ms: Date.now() - t0 });
          }

          return { diRaw, cacheHit };
        }
        catch (error) {
          log.error("di-check-cache-and-call - error", { error });
          throw new NonRetryableError("Failed to check cache and call DI backend");
        }
      });

      // Store DI artifact
      await step.do("di-store-artifact", async () => {
        try {
          log.info("di-store-artifact - starting step");
          if (cacheHit) {
            await putArtifactJson(env, jobId, "di_cached.json", diRaw);
            await repos.artifacts.record(jobId, "di_cached", `artifacts/${jobId}/di_cached.json`);
          } else {
            await putArtifactJson(env, jobId, "di_raw.json", diRaw);
            await repos.artifacts.record(jobId, "di_raw", `artifacts/${jobId}/di_raw.json`);
            if (cacheEnabled(env)) {
              await kvPutJson(env, ck, diRaw, cacheTtl(env));
            }
          }
        }
        catch (error) {
          log.error("di-store-artifact - error", { error });
          throw new NonRetryableError("Failed to store DI artifact");
        }
      });

      // --- Step 03 normalize + segment ---
      const { diNormalized, regions } = await step.do("normalize-segment", async () => {
        try {
          log.info("normalize-segment - starting step");
          await setStatus(env, jobId, { step: "segment", percent: 20, message: "Normalizing and segmenting DI output" });
          const diNormalized = normalizeDi(diRaw);
          const regions = segmentDi(diNormalized);
          await putArtifactJson(env, jobId, "di_normalized.json", diNormalized);
          await putArtifactJson(env, jobId, "regions.json", regions);
          return { diNormalized, regions };
        }
        catch (error) {
          log.error("normalize-segment - error", { error });
          throw new NonRetryableError("Failed to normalize and segment DI output");
        }
      });
      // --- Step 04 extract ---
      const extractProvider = (job.options?.extractProvider ?? env.LLM_DEFAULT_EXTRACT_PROVIDER) as
        | "openai"
        | "anthropic"
        | "gemini";
      const extractModel = (job.options?.extractModel ?? getModel(extractProvider, 'small')) as string;

      const extractedNodes: WbsNode[] = [];

      await step.do("extract-status-update", async () => {
        try {
          log.info("extract-status-update - starting step");
          await setStatus(env, jobId, {
            step: "extract_regions",
            percent: 30,
            message: `Extracting ${regions.length} regions`,
          });
        }
        catch (error) {
          log.error("extract-status-update - error", { error });
          throw new NonRetryableError("Failed to update extract status");
        }
      });

      // Extract each region in sequence (each as its own step for retry granularity)
      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        const nodes = await step.do(`extract-region-${region.regionId}`, async () => {
          try {

            await setStatus(env, jobId, {
              step: "extract_regions",
              percent: 30 + Math.floor((25 * (i + 1)) / regions.length),
              message: `Extracting region ${i + 1}/${regions.length}`,
            });

            log.info("extract_region_start", {
              regionId: region.regionId,
              type: region.type,
              tokenEstimate: region.tokenEstimate,
              provider: extractProvider,
              model: extractModel,
            });

            const { extraction, rawText } = await extractRegion(env, {
              jobId,
              mode: job.mode,
              region,
              llm: { provider: extractProvider, model: extractModel },
            });

            await putArtifactJson(env, jobId, `extractions/region_${region.regionId}.json`, { extraction, rawText });

            log.info("extract_region_done", {
              regionId: region.regionId,
              nodes: extraction.nodes.length,
              confidence: extraction.confidence,
            });

            return extraction.nodes.map((n) => ({ ...n, jobId }) as WbsNode);
          } catch (err: any) {
            console.log(err.name);
            console.log(err.message);
            console.log(err);

            if (err.name === 'AbortError') {
              // Timeout (if using AbortController)
              console.log('Request timed out');
            } else if (err.name === 'TypeError' && err.message.includes('network')) {
              // Connection drop / network failure
              console.log('Network connection lost');
            } else if (err.cause?.code === 'ECONNRESET') {
              // Connection reset by server
              console.log('Connection reset');
            } else if (err.cause?.code === 'ETIMEDOUT') {
              // TCP-level timeout
              console.log('Connection timed out');
            }
            throw new NonRetryableError("Failed to extract region");
          }
        });

        extractedNodes.push(...nodes);
      }

      // --- Step 05 validate ---
      const validationReport = await step.do("validate", async () => {
        try {
          log.info("validate - starting step");
          await setStatus(env, jobId, { step: "validate", percent: 60, message: "Validating and generating QC report" });
          const report = validateNodes(jobId, extractedNodes, regions);
          await putArtifactJson(env, jobId, "validation_report.json", report);
          return report;
        }
        catch (error) {
          log.error("validate - error", { error });
          throw new NonRetryableError("Failed to validate nodes");
        }
      });

      // --- Step 06 consolidate ---
      const draftNodes = await step.do("consolidate", async () => {
        try {
          log.info("consolidate - starting step");
          await setStatus(env, jobId, { step: "consolidate", percent: 65, message: "Consolidating nodes" });
          const draft = consolidate(extractedNodes, job.mode);
          await putArtifactJson(env, jobId, "document_draft.json", draft);
          return draft;
        }
        catch (error) {
          log.error("consolidate - error", { error });
          throw new NonRetryableError("Failed to consolidate nodes");
        }
      });

      // --- Step 07 verify ---
      const verifyProvider = (job.options?.verifyProvider ?? env.LLM_DEFAULT_VERIFY_PROVIDER) as
        | "openai"
        | "anthropic"
        | "gemini";
      const verifyModel = (job.options?.verifyModel ?? getModel(verifyProvider, 'large')) as string;

      const verifyOut = await step.do("verify", async () => {
        await setStatus(env, jobId, { step: "verify", percent: 75, message: "Verifying document" });

        const { out, rawText } = await verifyDocument(env, {
          jobId,
          mode: job.mode,
          nodes: draftNodes,
          validationReport,
          regions,
          llm: { provider: verifyProvider, model: verifyModel },
        });

        await putArtifactJson(env, jobId, "verifier_output.json", { verifyOut: out, verifyRaw: rawText });
        return out;
      });

      let finalNodes = verifyOut.correctedNodes;

      // --- Step 08 escalate if needed ---
      if (verifyOut.escalationPlan?.needed) {
        finalNodes = await step.do("escalate", async () => {
          await setStatus(env, jobId, {
            step: "escalate",
            percent: 82,
            message: "Escalation required; re-extracting targeted regions",
          });

          const targets = verifyOut.escalationPlan.targetRegionIds ?? [];
          log.warn("escalation_needed", { targets, reason: verifyOut.escalationPlan.reason });

          const patches = await escalateAndJudge(env, {
            jobId,
            mode: job.mode,
            targetRegionIds: targets,
            regions,
            extractCandidates: [
              { name: "openai_candidate", provider: "openai", model: getModel("openai", 'small') },
              { name: "anthropic_candidate", provider: "anthropic", model: getModel("anthropic", 'small') },
              { name: "gemini_candidate", provider: "gemini", model: getModel("gemini", 'small') },
            ],
            judge: { provider: verifyProvider, model: verifyModel },
          });

          // Patch strategy: replace nodes for affected regions by provenance.regionId match
          const targetSet = new Set(targets);
          let result = verifyOut.correctedNodes.filter((n) => !targetSet.has(n.provenance?.regionId));

          for (const regionId of Object.keys(patches)) {
            result.push(...patches[regionId]);
            await putArtifactJson(env, jobId, `escalations/${regionId}/selected_patch.json`, patches[regionId]);
          }

          return result;
        });
      }

      await step.do("store-final", async () => {
        await putArtifactJson(env, jobId, "document_final.json", finalNodes);
      });

      // --- Step 09 persist + summary ---
      await step.do("persist-nodes", async () => {
        await setStatus(env, jobId, { step: "persist", percent: 92, message: "Persisting nodes to MongoDB" });
        await repos.nodes.replaceForJob(jobId, finalNodes);
      });

      const summaryProvider = (job.options?.summaryProvider ?? env.LLM_DEFAULT_SUMMARY_PROVIDER) as
        | "openai"
        | "anthropic"
        | "gemini";
      const summaryModel = (job.options?.summaryModel ?? getModel(summaryProvider, 'small')) as string;

      await step.do("generate-summary", async () => {
        await setStatus(env, jobId, { step: "summary", percent: 96, message: "Generating summary" });

        const { summary, rawText } = await generateSummary(env, {
          jobId,
          mode: job.mode,
          nodes: finalNodes,
          validationReport,
          verifierIssues: verifyOut.issues ?? [],
          llm: { provider: summaryProvider, model: summaryModel },
        });

        await putArtifactJson(env, jobId, "summary.json", { summary, summaryRaw: rawText });
      });

      // Mark completed
      await step.do("mark-completed", async () => {
        const inferredCount = finalNodes.filter((n) => !!n.inferred).length;

        await repos.jobs.markCompleted(jobId, {
          nodeCount: finalNodes.length,
          inferredCount,
          coverageRatio: validationReport.coverage.coverageRatio,
        } as any);

        await setStatus(env, jobId, { state: "completed", step: "done", percent: 100, message: "Completed" });
        log.info("workflow_completed", { nodes: finalNodes.length, inferredCount });
      });
    } catch (err: any) {
      console.log("IN FAILED STATE!");

      const msg = err?.message ?? String(err);
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: "error", jobId, msg, stack: err?.stack }));

      await appendStatus(env, jobId, "error", "Job failed", { error: msg });
      await setStatus(env, jobId, { state: "failed", step: "failed", percent: 100, message: "Failed" });

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
