export function extractJsonObject(text: string): any {
  // naive extraction: find first { ... } block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON object found");
  const slice = text.slice(start, end + 1);
  return JSON.parse(slice);
}
