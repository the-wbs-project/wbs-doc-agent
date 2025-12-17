import type { JobMode } from "../models/job";
import type { WbsNode } from "../models/wbs";

export function consolidate(nodes: WbsNode[], mode: JobMode) {
  // Simple draft consolidation:
  // - If wbsLevel exists, infer parent by truncation if matching node exists.
  const byWbs = new Map<string, WbsNode>();
  for (const n of nodes) if (n.wbsLevel) byWbs.set(n.wbsLevel, n);

  const out = nodes.map(n => ({ ...n }));

  for (const n of out) {
    if (n.parentId) continue;
    if (!n.wbsLevel) continue;

    const parts = n.wbsLevel.split(".");
    if (parts.length <= 1) continue;
    const parentLevel = parts.slice(0, -1).join(".");
    const parent = byWbs.get(parentLevel);
    if (parent) {
      n.parentId = parent.id;
      if (mode === "best_judgment") {
        n.inferred = true;
        n.warnings = [...(n.warnings ?? []), "inferred_parent_from_wbsLevel"];
      } else {
        // strict: still ok if derived from explicit numbering; mark warning rather than inferred
        n.warnings = [...(n.warnings ?? []), "parent_assigned_from_wbsLevel"];
      }
    }
  }

  return out;
}
