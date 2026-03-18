import { S3Client } from "@aws-sdk/client-s3";

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing ${name} env var`);
  return value;
}

function getR2Config() {
  const bucket = required("S3_BUCKET", process.env.S3_BUCKET);
  const rawEndpoint = required("S3_ENDPOINT", process.env.S3_ENDPOINT).replace(/\/$/, "");
  // Allow either account endpoint (recommended) OR endpoint that includes "/<bucket>"
  const endpoint = rawEndpoint.endsWith(`/${bucket}`) ? rawEndpoint.slice(0, -(`/${bucket}`.length)) : rawEndpoint;

  return {
    region: process.env.S3_REGION || "auto",
    endpoint,
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY", process.env.S3_SECRET_ACCESS_KEY),
    },
    forcePathStyle: true,
  } as const;
}

let client: S3Client | undefined;
export function getR2Client() {
  if (!client) client = new S3Client(getR2Config());
  return client;
}

export function getBucket() {
  return required("S3_BUCKET", process.env.S3_BUCKET);
}

export function getPublicBaseUrl() {
  const raw =
    process.env.S3_FILE_URL ||
    process.env.S3_PUBLIC_URL ||
    process.env.S3_ENDPOINT;
  if (!raw) throw new Error("Missing S3 public base URL env var (S3_FILE_URL or S3_PUBLIC_URL or S3_ENDPOINT)");
  return raw.replace(/\/$/, "");
}

export function buildPublicUrl(key: string) {
  const base = getPublicBaseUrl();
  const bucket = getBucket();
  const normalizedKey = key.replace(/^\/+/, "");

  // If someone configured the base URL with a fixed prefix (e.g. ".../uploads")
  // and our keys already start with that same prefix, avoid duplicating it.
  // Example desired:
  //   base: https://pub-xxx.r2.dev/uploads
  //   key:  uploads/cover/...
  //   =>    https://pub-xxx.r2.dev/uploads/cover/...
  let baseNoDup = base;
  try {
    const u = new URL(base);
    const basePath = u.pathname.replace(/\/+$/, ""); // "" or "/uploads" etc
    const baseLastSeg = basePath.split("/").filter(Boolean).at(-1);
    const keyFirstSeg = normalizedKey.split("/").filter(Boolean)[0];
    if (baseLastSeg && keyFirstSeg && baseLastSeg === keyFirstSeg) {
      const trimmedPath = basePath.split("/").slice(0, -1).join("/") || "/";
      u.pathname = trimmedPath;
      baseNoDup = u.toString().replace(/\/$/, "");
    }
  } catch {
    // ignore parsing errors; treat as plain string below
  }

  // Cloudflare R2 public bucket domains are bucket-bound already:
  //   https://<something>.r2.dev/<key>
  // so they MUST NOT include "/<bucket>/" in the path.
  try {
    const u = new URL(baseNoDup);
    if (u.hostname.toLowerCase().endsWith(".r2.dev")) return `${baseNoDup}/${normalizedKey}`;
  } catch {
    // non-URL base; fall through
    if (/\.r2\.dev(\/|$)/i.test(baseNoDup)) return `${baseNoDup}/${normalizedKey}`;
  }

  // If the configured base already includes the bucket path, don't add it again.
  // Examples:
  //   https://cdn.example.com/turncoat
  //   https://<accountid>.r2.cloudflarestorage.com/turncoat
  if (baseNoDup.endsWith(`/${bucket}`)) return `${baseNoDup}/${normalizedKey}`;

  // Otherwise, we assume it's an account endpoint (bucketless) and must include bucket in the path.
  return `${baseNoDup}/${bucket}/${normalizedKey}`;
}

