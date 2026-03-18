import type { IncomingMessage, ServerResponse } from "node:http";
import { ensureSchema, getPool } from "./_lib/db.js";
import { getSessionFromAuthHeader } from "./_lib/session.js";
import { allowMethods, sendJson } from "./_lib/http.js";

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
    await ensureSchema();
    getSessionFromAuthHeader(req.headers.authorization);

    const url = getUrl(req);
    const limitRaw = Number(url.searchParams.get("limit") || "8");
    const limit = Math.max(1, Math.min(25, Number.isFinite(limitRaw) ? limitRaw : 8));
    const minutesRaw = Number(url.searchParams.get("minutes") || "15");
    const minutes = Math.max(1, Math.min(24 * 60, Number.isFinite(minutesRaw) ? minutesRaw : 15));
    const since = new Date(Date.now() - minutes * 60_000).toISOString();

    const pool = getPool();
    const result = await pool.query(
      `
      select u.id, u.username, u.last_seen, p.full_name, p.avatar_url
      from users u
      left join profiles p on p.user_id = u.id
      where u.last_seen >= $1
      order by u.last_seen desc
      limit ${limit}
      `,
      [since]
    );

    const online = result.rows.map((r) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      avatarUrl: r.avatar_url,
      lastSeen: r.last_seen,
    }));

    return sendJson(res, 200, { online, minutes });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

