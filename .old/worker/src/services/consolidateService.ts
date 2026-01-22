import type { WbsNode } from "../models/wbs";

export function consolidate(nodes: WbsNode[]) {
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
      // strict: still ok if derived from explicit numbering; mark warning rather than inferred
      n.warnings = [...(n.warnings ?? []), "parent_assigned_from_wbsLevel"];
    }
  }

  return out;
}
