import type { IncomingMessage, ServerResponse } from "node:http";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { allowMethods, readJson, sendJson } from "./_lib/http.js";
import { getSessionFromAuthHeader } from "./_lib/session.js";
import { buildPublicUrl, getBucket, getR2Client } from "./_lib/r2.js";

type UploadBody = {
  kind?: "avatar" | "cover" | "post";
  contentType?: string;
  filename?: string;
};

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);

function safeExtFromContentType(ct: string) {
  if (ct === "image/jpeg") return "jpg";
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  if (ct === "video/mp4") return "mp4";
  if (ct === "video/webm") return "webm";
  return "bin";
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    allowMethods(res, ["POST"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const session = getSessionFromAuthHeader(req.headers.authorization);
    const body = await readJson<UploadBody>(req);
    const kind = body.kind || "post";
    const contentType = (body.contentType || "").toLowerCase() || "application/octet-stream";

    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return sendJson(res, 400, { error: "Unsupported content type" });
    }

    const ext = safeExtFromContentType(contentType);
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");

    const id =
      (globalThis.crypto as any)?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const key = `uploads/${kind}/${session.userId}/${yyyy}/${mm}/${dd}/${id}.${ext}`;
    const bucket = getBucket();
    const client = getR2Client();

    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 60 }
    );

    const publicUrl = buildPublicUrl(key);

    return sendJson(res, 200, { key, uploadUrl, publicUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

