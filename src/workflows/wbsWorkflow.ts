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
import * as artifactsRepo from "../services/mongo/repositories/artifactsRepo";
import * as jobsRepo from "../services/mongo/repositories/jobsRepo";
import * as nodesRepo from "../services/mongo/repositories/nodesRepo";
import { getR2Object } from "../services/r2Service";
import { segmentDi } from "../services/segmentService";
import { generateSummary } from "../services/summaryService";
import { validateNodes } from "../services/validateService";
import { verifyDocument } from "../services/verifyService";
import { appendStatus, setStatus } from "../status/statusClient";

type Params = { jobId: string };

export class WbsWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { jobId } = event.payload;
    const log = createLogger({ jobId, scope: "workflow" });
    const env = this.env;

    try {
      // Mark job running
      await step.do("mark-running", async () => {
        await jobsRepo.markRunning(env, jobId);
        await setStatus(env, jobId, { state: "running", step: "start", percent: 2, message: "Workflow started" });
      });

      // Load job record
      const job = await step.do("load-job", async () => {
        const j = await jobsRepo.getJob(env, jobId);
        log.info("loaded_job", { mode: j.mode, r2UploadKey: j.r2UploadKey });
        return j;
      });

      // --- Step 02: DI with cache ---
      await step.do("di-status-update", async () => {
        await setStatus(env, jobId, { step: "di", percent: 8, message: "Checking DI cache" });
      });

      const ck = diCacheKey(job.fileHashSha256, env.DI_MODEL, env.DI_BACKEND_VERSION);

      const { diRaw, cacheHit } = await step.do("di-check-cache-and-call", async () => {
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
      });

      // Store DI artifact
      await step.do("di-store-artifact", async () => {
        if (cacheHit) {
          await putArtifactJson(env, jobId, "di_cached.json", diRaw);
          await artifactsRepo.recordArtifact(env, jobId, "di_cached", `artifacts/${jobId}/di_cached.json`);
        } else {
          await putArtifactJson(env, jobId, "di_raw.json", diRaw);
          await artifactsRepo.recordArtifact(env, jobId, "di_raw", `artifacts/${jobId}/di_raw.json`);
          if (cacheEnabled(env)) {
            await kvPutJson(env, ck, diRaw, cacheTtl(env));
          }
        }
      });

      // --- Step 03 normalize + segment ---
      const { diNormalized, regions } = await step.do("normalize-segment", async () => {
        await setStatus(env, jobId, { step: "segment", percent: 20, message: "Normalizing and segmenting DI output" });
        const diNormalized = normalizeDi(diRaw);
        const regions = segmentDi(diNormalized);
        await putArtifactJson(env, jobId, "di_normalized.json", diNormalized);
        await putArtifactJson(env, jobId, "regions.json", regions);
        return { diNormalized, regions };
      });

      // --- Step 04 extract ---
      const extractProvider = (job.options?.extractProvider ?? env.LLM_DEFAULT_EXTRACT_PROVIDER) as "openai" | "anthropic" | "gemini";
      const extractModel = (job.options?.extractModel ?? (extractProvider === "gemini" ? "gemini-1.5-flash" : "gpt-4o-mini")) as string;

      const extractedNodes: WbsNode[] = [];

      await step.do("extract-status-update", async () => {
        await setStatus(env, jobId, { step: "extract_regions", percent: 30, message: `Extracting ${regions.length} regions` });
      });

      // Extract each region in sequence (each as its own step for retry granularity)
      for (let i = 0; i < regions.length; i++) {
        const region = regions[i];
        const nodes = await step.do(`extract-region-${region.regionId}`, async () => {
          await setStatus(env, jobId, {
            step: "extract_regions",
            percent: 30 + Math.floor((25 * (i + 1)) / regions.length),
            message: `Extracting region ${i + 1}/${regions.length}`
          });

          log.info("extract_region_start", {
            regionId: region.regionId,
            type: region.type,
            tokenEstimate: region.tokenEstimate,
            provider: extractProvider,
            model: extractModel
          });

          const { extraction, rawText } = await extractRegion(env, {
            jobId,
            mode: job.mode,
            region,
            llm: { provider: extractProvider, model: extractModel }
          });

          await putArtifactJson(env, jobId, `extractions/region_${region.regionId}.json`, { extraction, rawText });

          log.info("extract_region_done", {
            regionId: region.regionId,
            nodes: extraction.nodes.length,
            confidence: extraction.confidence
          });

          return extraction.nodes.map(n => ({ ...n, jobId } as WbsNode));
        });

        extractedNodes.push(...nodes);
      }

      // --- Step 05 validate ---
      const validationReport = await step.do("validate", async () => {
        await setStatus(env, jobId, { step: "validate", percent: 60, message: "Validating and generating QC report" });
        const report = validateNodes(jobId, extractedNodes, regions);
        await putArtifactJson(env, jobId, "validation_report.json", report);
        return report;
      });

      // --- Step 06 consolidate ---
      const draftNodes = await step.do("consolidate", async () => {
        await setStatus(env, jobId, { step: "consolidate", percent: 65, message: "Consolidating nodes" });
        const draft = consolidate(extractedNodes, job.mode);
        await putArtifactJson(env, jobId, "document_draft.json", draft);
        return draft;
      });

      // --- Step 07 verify ---
      const verifyProvider = (job.options?.verifyProvider ?? env.LLM_DEFAULT_VERIFY_PROVIDER) as "openai" | "anthropic" | "gemini";
      const verifyModel = (job.options?.verifyModel ?? (verifyProvider === "anthropic" ? "claude-3-5-sonnet-latest" : "gpt-4o")) as string;

      const verifyOut = await step.do("verify", async () => {
        await setStatus(env, jobId, { step: "verify", percent: 75, message: "Verifying document" });

        const { out, rawText } = await verifyDocument(env, {
          jobId,
          mode: job.mode,
          nodes: draftNodes,
          validationReport,
          regions,
          llm: { provider: verifyProvider, model: verifyModel }
        });

        await putArtifactJson(env, jobId, "verifier_output.json", { verifyOut: out, verifyRaw: rawText });
        return out;
      });

      let finalNodes = verifyOut.correctedNodes;

      // --- Step 08 escalate if needed ---
      if (verifyOut.escalationPlan?.needed) {
        finalNodes = await step.do("escalate", async () => {
          await setStatus(env, jobId, { step: "escalate", percent: 82, message: "Escalation required; re-extracting targeted regions" });

          const targets = verifyOut.escalationPlan.targetRegionIds ?? [];
          log.warn("escalation_needed", { targets, reason: verifyOut.escalationPlan.reason });

          const patches = await escalateAndJudge(env, {
            jobId,
            mode: job.mode,
            targetRegionIds: targets,
            regions,
            extractCandidates: [
              { name: "openai_candidate", provider: "openai", model: "gpt-4o-mini" },
              { name: "anthropic_candidate", provider: "anthropic", model: "claude-3-5-haiku-latest" },
              { name: "gemini_candidate", provider: "gemini", model: "gemini-1.5-flash" }
            ],
            judge: { provider: verifyProvider, model: verifyModel }
          });

          // Patch strategy: replace nodes for affected regions by provenance.regionId match
          const targetSet = new Set(targets);
          let result = verifyOut.correctedNodes.filter(n => !targetSet.has(n.provenance?.regionId));

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
        await nodesRepo.replaceNodesForJob(env, jobId, finalNodes);
      });

      const summaryProvider = (job.options?.summaryProvider ?? env.LLM_DEFAULT_SUMMARY_PROVIDER) as "openai" | "anthropic" | "gemini";
      const summaryModel = (job.options?.summaryModel ?? (summaryProvider === "openai" ? "gpt-4o-mini" : verifyModel)) as string;

      await step.do("generate-summary", async () => {
        await setStatus(env, jobId, { step: "summary", percent: 96, message: "Generating summary" });

        const { summary, rawText } = await generateSummary(env, {
          jobId,
          mode: job.mode,
          nodes: finalNodes,
          validationReport,
          verifierIssues: verifyOut.issues ?? [],
          llm: { provider: summaryProvider, model: summaryModel }
        });

        await putArtifactJson(env, jobId, "summary.json", { summary, summaryRaw: rawText });
      });

      // Mark completed
      await step.do("mark-completed", async () => {
        const inferredCount = finalNodes.filter(n => !!n.inferred).length;

        await jobsRepo.markCompleted(env, jobId, {
          nodeCount: finalNodes.length,
          inferredCount,
          coverageRatio: validationReport.coverage.coverageRatio
        } as any);

        await setStatus(env, jobId, { state: "completed", step: "done", percent: 100, message: "Completed" });
        log.info("workflow_completed", { nodes: finalNodes.length, inferredCount });
      });

    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: "error", jobId, msg, stack: err?.stack }));

      await appendStatus(env, jobId, "error", "Job failed", { error: msg });
      await setStatus(env, jobId, { state: "failed", step: "failed", percent: 100, message: "Failed" });

      // best-effort mark in mongo
      try { await jobsRepo.markFailed(env, jobId, msg); } catch { /* ignore */ }
      throw err;
    }
  }
}
