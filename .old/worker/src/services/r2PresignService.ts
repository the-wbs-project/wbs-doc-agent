// Minimal SigV4 presign for GET object (S3 compatible).
// This is intentionally small; it signs a canonical request for GET /bucket/key.
//
// Assumptions:
// - env.R2_S3_ENDPOINT like https://<accountid>.r2.cloudflarestorage.com
// - env.R2_S3_BUCKET is bucket name
// - region is "auto"
// - service is "s3"

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function encodeRFC3986(str: string) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}
async function hmac(key: ArrayBuffer, msg: string) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(msg));
}
async function sha256(msg: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
}

async function getSignatureKey(secret: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmac(new TextEncoder().encode("AWS4" + secret).buffer as ArrayBuffer, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  return kSigning;
}

export async function presignR2GetUrl(env: Env, objectKey: string, expiresSeconds: number) {
  const endpoint = env.R2_S3_ENDPOINT.replace(/\/+$/, "");
  const bucket = env.R2_S3_BUCKET;
  const region = env.R2_S3_REGION || "auto";
  const service = "s3";

  const accessKey = env.R2_ACCESS_KEY_ID;
  const secretKey = env.R2_SECRET_ACCESS_KEY;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);

  const host = new URL(endpoint).host;

  const canonicalUri = `/${bucket}/${objectKey.split("/").map(encodeRFC3986).join("/")}`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const algorithm = "AWS4-HMAC-SHA256";

  const query: Record<string, string> = {
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": `${accessKey}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresSeconds),
    "X-Amz-SignedHeaders": "host"
  };

  const canonicalQueryString = Object.keys(query).sort().map(k => `${encodeRFC3986(k)}=${encodeRFC3986(query[k])}`).join("&");
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = "UNSIGNED-PAYLOAD";

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join("\n");

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    toHex(await sha256(canonicalRequest))
  ].join("\n");

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = toHex(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), new TextEncoder().encode(stringToSign)));

  const finalQuery = canonicalQueryString + `&X-Amz-Signature=${signature}`;
  return `${endpoint}${canonicalUri}?${finalQuery}`;
}
