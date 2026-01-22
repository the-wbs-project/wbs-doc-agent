import type { Region } from "../models/regions";
import type { WbsNode } from "../models/wbs";
import type { JobMode } from "../models/job";

export const PROMPT_ID = "step08_judge_merge_v2";

export const JSON_SCHEMA_HINT = `
Return JSON ONLY:
{
  "selected": {
    "strategy": "pick_one" | "merge",
    "winningCandidate": string | null,
    "selectedNodes": Array<WbsNode>
  },
  "rationale": string,
  "problems": Array<{ "candidate": string, "issue": string }>
}
`;

export const SYSTEM_PROMPT = `
You are a judge selecting or merging candidate WBS extractions for a single region.
Prefer content support over completeness. Output JSON only.
`;

export function buildUserPrompt(input: {
  jobId: string;
  mode: JobMode;
  region: Region;
  candidates: Array<{ name: string; provider: string; model: string; nodes: WbsNode[]; rawNotes?: string }>;
}) {
  return `
JobId: ${input.jobId}
Mode: ${input.mode}

REGION:
${JSON.stringify({ regionId: input.region.regionId, pageOrSheet: input.region.pageOrSheet })}

MARKDOWN CONTENT:
${input.region.text}

CANDIDATES:
${JSON.stringify(input.candidates)}

OUTPUT:
${JSON_SCHEMA_HINT}
`;
}
