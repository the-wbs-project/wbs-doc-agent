import type { GlobalAnalysis, RegionGuidance } from "../models/globalAnalysis";
import type { Region } from "../models/regions";
import type { SiteConfig } from "../models/site-config";
import * as prompt from "../prompts/step03b_global_analysis";
import type { NormalizedDi } from "./diNormalizeService";
import { generateJson } from "./llm/llmClient";

/**
 * Performs global document analysis using a large-context LLM.
 * Analyzes the entire document to identify patterns, structure, and provide
 * extraction guidance for each region.
 */
export async function analyzeDocument(config: SiteConfig, input: {
  jobId: string;
  diNormalized: NormalizedDi;
  regions: Region[];
  llm: { provider: "openai" | "anthropic" | "gemini"; model: string };
}): Promise<{ analysis: GlobalAnalysis; rawText: string }> {

  const { jobId, diNormalized, regions, llm } = input;

  // Build full document content from normalized data
  const fullContent = buildFullDocumentContent(diNormalized, regions);
  const pageCount = diNormalized.pages.length || 1;

  const messages = [
    { role: "system" as const, content: prompt.SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: prompt.buildUserPrompt({
        jobId,
        fullContent,
        regions,
        pageCount
      })
    }
  ];

  const { json, rawText } = await generateJson<GlobalAnalysis>(config, {
    provider: llm.provider,
    model: llm.model,
    temperature: 0.2
  }, messages);

  // Post-process: ensure all regions have guidance
  const analysis = ensureCompleteGuidance(json, regions);

  return { analysis, rawText };
}

/**
 * Builds a full document content string from normalized DI output.
 * Organizes content by page with clear markers.
 */
function buildFullDocumentContent(diNormalized: NormalizedDi, regions: Region[]): string {
  // If we have the full markdown content, use that
  if (diNormalized.content && diNormalized.content.length > 0) {
    return diNormalized.content;
  }

  // Otherwise, build from regions
  const parts: string[] = [];
  let currentPage = "";

  for (const region of regions) {
    if (region.pageOrSheet !== currentPage) {
      currentPage = region.pageOrSheet;
      parts.push(`\n=== ${currentPage.toUpperCase()} ===\n`);
    }
    parts.push(region.text);
    parts.push("\n");
  }

  return parts.join("\n");
}

/**
 * Ensures every region has guidance, filling in defaults if LLM missed any.
 */
function ensureCompleteGuidance(analysis: GlobalAnalysis, regions: Region[]): GlobalAnalysis {
  const guidanceMap = new Map<string, RegionGuidance>();

  // Index existing guidance
  for (const g of analysis.regionGuidance || []) {
    guidanceMap.set(g.regionId, g);
  }

  // Fill in missing regions
  for (const region of regions) {
    if (!guidanceMap.has(region.regionId)) {
      guidanceMap.set(region.regionId, {
        regionId: region.regionId,
        pageOrSheet: region.pageOrSheet,
        context: {
          sectionPath: [],
          suggestedParentWbs: "",
          layoutHint: region.type === "table" ? "table" : "unknown",
          extractionNotes: "No specific guidance available. Extract items as found."
        }
      });

      // Add warning that this region was missed
      if (!analysis.warnings) {
        analysis.warnings = [];
      }
      analysis.warnings.push(`missing_guidance_for_region:${region.regionId}`);
    }
  }

  return {
    ...analysis,
    regionGuidance: Array.from(guidanceMap.values())
  };
}

/**
 * Estimates token count for the full document content.
 * Used to determine if document is within context limits.
 */
export function estimateDocumentTokens(diNormalized: NormalizedDi, regions: Region[]): number {
  const content = buildFullDocumentContent(diNormalized, regions);
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(content.length / 4);
}
