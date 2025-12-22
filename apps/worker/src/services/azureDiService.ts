import type { SiteConfig } from "../models/site-config";

export async function analyzeWithDiBackend(config: SiteConfig, input: {
  fileObj: R2ObjectBody;
  fileKey: string;
}) {
  const formData = new FormData();
  formData.append('file', await input.fileObj.blob(), input.fileKey.split('/').pop() || 'file.pdf');

  const res = await fetch(config.diBackendUrl, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`DI backend failed: ${res.status} ${txt}`);
  }
  return await res.json();
}
