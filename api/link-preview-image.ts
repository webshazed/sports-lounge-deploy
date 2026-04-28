import type { IncomingMessage, ServerResponse } from "node:http";
import { allowMethods, sendJson } from "./_lib/http.js";
import { fetchPreviewImage } from "./_lib/linkPreview.js";

function getUrl(req: IncomingMessage) {
  const host = req.headers.host || "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const path = req.url || "/";
  return new URL(path, `${proto}://${host}`);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    allowMethods(res, ["GET"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const url = getUrl(req).searchParams.get("url") || "";
    if (!url.trim()) return sendJson(res, 400, { error: "URL is required" });

    const image = await fetchPreviewImage(url);
    res.statusCode = 200;
    res.setHeader("Content-Type", image.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.end(image.body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch image";
    return sendJson(res, 400, { error: message });
  }
}
