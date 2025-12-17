import type { Region } from "../models/regions";
import { uuid } from "./id";

function estimateTokens(text: string) {
  // crude approximation: 1 token ~ 4 chars
  return Math.ceil(text.length / 4);
}

export function segmentDi(diNormalized: any): Region[] {
  const regions: Region[] = [];

  const pages = diNormalized.pages ?? [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageLabel = String(p.pageNumber ?? (i + 1));

    // tables
    const tables = p.tables ?? diNormalized.tables ?? [];
    for (const t of tables) {
      const regionId = uuid();
      const text = JSON.stringify({ table: t }, null, 0);
      regions.push({
        regionId,
        type: "table",
        pageOrSheet: `page:${pageLabel}`,
        text,
        evidenceRefs: { tableId: t.id ?? t.tableId ?? null },
        tokenEstimate: estimateTokens(text)
      });
    }

    // paragraphs
    const paragraphs = p.paragraphs ?? diNormalized.paragraphs ?? [];
    if (paragraphs.length) {
      const regionId = uuid();
      const lines = paragraphs.map((para: any, idx: number) => `${idx+1}. ${(para.content ?? para.text ?? "").trim()}`);
      const text = lines.join("\n");
      regions.push({
        regionId,
        type: "paragraph_block",
        pageOrSheet: `page:${pageLabel}`,
        text,
        evidenceRefs: { paragraphCount: paragraphs.length },
        tokenEstimate: estimateTokens(text)
      });
    }
  }

  if (!regions.length) {
    regions.push({
      regionId: uuid(),
      type: "unknown",
      pageOrSheet: "unknown",
      text: JSON.stringify(diNormalized.raw ?? {}, null, 0).slice(0, 8000),
      evidenceRefs: { note: "fallback_region" },
      tokenEstimate: estimateTokens(JSON.stringify(diNormalized.raw ?? {}).slice(0, 8000))
    });
  }

  return regions;
}
