export async function analyzeWithDiBackend(env: Env, input: {
  fileObj: R2ObjectBody;
  fileKey: string;
}) {
  const formData = new FormData();
  formData.append('file', await input.fileObj.blob(), input.fileKey.split('/').pop() || 'file.pdf');

  const res = await fetch(env.DI_BACKEND_URL, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`DI backend failed: ${res.status} ${txt}`);
  }
  return await res.json();
}
