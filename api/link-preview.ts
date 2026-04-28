import type { IncomingMessage, ServerResponse } from "node:http";
import { allowMethods, sendJson } from "./_lib/http.js";
import { fetchLinkPreview } from "./_lib/linkPreview.js";

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

    const preview = await fetchLinkPreview(url);
    return sendJson(res, 200, { preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch preview";
    return sendJson(res, 400, { error: message });
  }
}
