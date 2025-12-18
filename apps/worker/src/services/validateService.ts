import type { WbsNode } from "../models/wbs";
import type { Region } from "../models/regions";
import type { ValidationReport } from "../models/qc";

export function validateNodes(jobId: string, nodes: WbsNode[], regions: Region[]): ValidationReport {
  const unsupportedNodes: ValidationReport["unsupportedNodes"] = [];
  const duplicates: ValidationReport["duplicates"] = [];
  const numberingIssues: ValidationReport["numberingIssues"] = [];
  const hierarchyIssues: ValidationReport["hierarchyIssues"] = [];

  const seen = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.title?.trim()) unsupportedNodes.push({ nodeId: n.id, reason: "missing_title" });
    if (!n.provenance?.quote?.trim()) unsupportedNodes.push({ nodeId: n.id, reason: "missing_provenance_quote" });

    const key = `${n.title.trim().toLowerCase()}|${n.wbsLevel ?? ""}|${n.provenance?.quote ?? ""}`;
    seen.set(key, [...(seen.get(key) ?? []), n.id]);

    if (n.parentId === n.id) hierarchyIssues.push({ nodeId: n.id, issue: "parentId_self" });
    if (n.wbsLevel && !/^[A-Za-z0-9]+(\.[A-Za-z0-9]+)*$/.test(n.wbsLevel)) numberingIssues.push({ nodeId: n.id, issue: "wbsLevel_format_suspicious" });
  }

  for (const [k, ids] of seen.entries()) {
    if (ids.length > 1) duplicates.push({ nodeIds: ids, reason: "same_title_level_quote" });
  }

  const totalEvidenceCount = regions.reduce((acc, r) => acc + Math.max(1, r.text.split("\n").length), 0);
  const consumedEvidenceCount = nodes.length;
  const coverageRatio = Math.min(1, consumedEvidenceCount / Math.max(1, totalEvidenceCount));

  return {
    schemaValid: unsupportedNodes.length === 0,
    unsupportedNodes,
    duplicates,
    numberingIssues,
    hierarchyIssues,
    coverage: { consumedEvidenceCount, totalEvidenceCount, coverageRatio },
    regionRiskScores: regions.map(r => ({
      regionId: r.regionId,
      risk: 0,
      reasons: []
    }))
  };
}
