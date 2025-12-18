export function normalizeDi(diRaw: any) {
  // TODO: adapt to your DI backend output format.
  // Goal: return a stable internal representation used by segmentService.
  return {
    raw: diRaw,
    pages: diRaw?.pages ?? [],
    tables: diRaw?.tables ?? [],
    paragraphs: diRaw?.paragraphs ?? []
  };
}
