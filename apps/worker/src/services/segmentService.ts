import type { Region } from "../models/regions";
import type { NormalizedDi } from "./diNormalizeService";
import { uuid } from "./id";

function estimateTokens(text: string) {
  // crude approximation: 1 token ~ 4 chars
  return Math.ceil(text.length / 4);
}

export function segmentDi(diNormalized: NormalizedDi): Region[] {
  const regions: Region[] = [];

  const pages = diNormalized.pages ?? [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageLabel = String(p.pageNumber ?? (i + 1));

    // Combine all page content
    const parts: string[] = [];

    // Tables as markdown-style representation
    const tables = p.tables ?? [];
    for (const t of tables) {
      if (t.cells) {
        parts.push(tableToMarkdown(t));
      } else {
        parts.push(JSON.stringify(t, null, 2));
      }
    }

    // Paragraphs
    const paragraphs = p.paragraphs ?? [];
    for (const para of paragraphs) {
      parts.push((para.content ?? "").trim());
    }

    // Lines as fallback
    const lines = p.lines ?? [];
    if (!paragraphs.length && lines.length) {
      for (const line of lines) {
        parts.push((line.content ?? "").trim());
      }
    }

    if (parts.length) {
      const text = parts.join("\n\n");
      regions.push({
        regionId: uuid(),
        pageOrSheet: `page:${pageLabel}`,
        text,
        page: p,
        tokenEstimate: estimateTokens(text + JSON.stringify(p))
      });
    }
  }

  return regions;
}

/**
 * Convert DI table structure to markdown table format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tableToMarkdown(table: Record<string, unknown>): string {
  if (!table.cells || !Array.isArray(table.cells)) {
    return JSON.stringify(table, null, 2);
  }

  // Find dimensions
  let maxRow = 0;
  let maxCol = 0;
  for (const cell of table.cells) {
    const rowEnd = (cell.rowIndex ?? 0) + (cell.rowSpan ?? 1);
    const colEnd = (cell.columnIndex ?? 0) + (cell.columnSpan ?? 1);
    if (rowEnd > maxRow) maxRow = rowEnd;
    if (colEnd > maxCol) maxCol = colEnd;
  }

  // Build grid
  const grid: string[][] = Array.from({ length: maxRow }, () =>
    Array.from({ length: maxCol }, () => "")
  );

  for (const cell of table.cells) {
    const row = cell.rowIndex ?? 0;
    const col = cell.columnIndex ?? 0;
    const content = (cell.content ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
    grid[row][col] = content;
  }

  // Convert to markdown
  const lines: string[] = [];
  for (let r = 0; r < grid.length; r++) {
    lines.push("| " + grid[r].join(" | ") + " |");
    if (r === 0) {
      lines.push("| " + grid[r].map(() => "---").join(" | ") + " |");
    }
  }

  return lines.join("\n");
}
