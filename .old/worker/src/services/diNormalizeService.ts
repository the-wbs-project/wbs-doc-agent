/**
 * Normalizes raw Azure Document Intelligence output into a stable internal representation.
 *
 * The DI backend returns a structure like:
 * {
 *   link: string,
 *   markdown: {
 *     apiVersion: string,
 *     modelId: string,
 *     content: string,           // Full markdown text
 *     pages: [...],              // Page objects with lines, spans, polygons
 *     paragraphs: [...],         // Paragraph objects with content, boundingRegions
 *     sections: [...],           // Section hierarchy
 *     contentFormat: string
 *   }
 * }
 */

export interface NormalizedPage {
  pageNumber: number;
  lines: Array<{
    content: string;
    polygon?: number[];
    spans?: Array<{ offset: number; length: number }>;
  }>;
  tables: any[];
  paragraphs: Array<{
    content: string;
    role?: string;
    boundingRegions?: Array<{
      pageNumber: number;
      polygon?: number[];
    }>;
  }>;
}

export interface NormalizedDi {
  raw: any;
  link?: string;
  content: string;
  pages: NormalizedPage[];
  paragraphs: Array<{
    content: string;
    role?: string;
    pageNumber?: number;
    boundingRegions?: any[];
  }>;
  tables: any[];
  sections: any[];
}

export function normalizeDi(diRaw: any): NormalizedDi {
  // Handle case where DI output is nested under 'markdown' property
  const markdown = diRaw?.markdown ?? diRaw;

  const rawPages = markdown?.pages ?? [];
  const rawParagraphs = markdown?.paragraphs ?? [];
  const rawSections = markdown?.sections ?? [];
  const rawTables = markdown?.tables ?? [];

  // Group paragraphs by page number
  const paragraphsByPage = new Map<number, typeof rawParagraphs>();
  for (const para of rawParagraphs) {
    const pageNum = para.boundingRegions?.[0]?.pageNumber ?? 1;
    if (!paragraphsByPage.has(pageNum)) {
      paragraphsByPage.set(pageNum, []);
    }
    paragraphsByPage.get(pageNum)!.push(para);
  }

  // Build normalized pages
  const pages: NormalizedPage[] = rawPages.map((page: any, idx: number) => {
    const pageNumber = page.pageNumber ?? (idx + 1);

    // Get paragraphs for this page - keep ALL paragraphs including headers/footers
    // Headers often contain section titles important for WBS structure
    const pageParagraphs = paragraphsByPage.get(pageNumber) ?? [];

    return {
      pageNumber,
      lines: (page.lines ?? []).map((line: any) => ({
        content: line.content ?? '',
        polygon: line.polygon,
        spans: line.spans
      })),
      tables: [], // Tables will be added if present at page level
      paragraphs: pageParagraphs.map((p: any) => ({
        content: p.content ?? '',
        role: p.role,
        boundingRegions: p.boundingRegions
      }))
    };
  });

  // If no pages found, create a single page from all paragraphs
  if (pages.length === 0 && rawParagraphs.length > 0) {
    pages.push({
      pageNumber: 1,
      lines: [],
      tables: [],
      paragraphs: rawParagraphs.map((p: any) => ({
        content: p.content ?? '',
        role: p.role,
        boundingRegions: p.boundingRegions
      }))
    });
  }

  // Build flat paragraphs array with page info
  const paragraphs = rawParagraphs.map((p: any) => ({
    content: p.content ?? '',
    role: p.role,
    pageNumber: p.boundingRegions?.[0]?.pageNumber,
    boundingRegions: p.boundingRegions
  }));

  const content = diRaw?.content ?? '';

  delete diRaw.content;

  return {
    link: diRaw?.link,
    pages,
    paragraphs,
    tables: rawTables,
    sections: rawSections,
    raw: diRaw,
    content
  };
}
