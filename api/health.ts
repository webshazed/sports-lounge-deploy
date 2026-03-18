import type { IncomingMessage, ServerResponse } from "node:http";
import { allowMethods, sendJson } from "./_lib/http.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    allowMethods(res, ["GET"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const hasDatabaseUrl = Boolean(
    process.env.POSTGRES_URL ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL_NON_POOLING
  );

  return sendJson(res, 200, {
    ok: true,
    nodeEnv: process.env.NODE_ENV || "unknown",
    hasDatabaseUrl,
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    hasS3: Boolean(process.env.S3_BUCKET && process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID),
  });
}

