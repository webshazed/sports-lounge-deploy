import type { IncomingMessage, ServerResponse } from "node:http";
import { ensureSchema, getPool } from "./_lib/db.js";
import { getSessionFromAuthHeader } from "./_lib/session.js";
import { allowMethods, readJson, sendJson } from "./_lib/http.js";

function getUrl(req: IncomingMessage) {
  const host = req.headers.host || "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const path = req.url || "/";
  return new URL(path, `${proto}://${host}`);
}

type MarkReadBody = {
  ids?: number[];
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    allowMethods(res, ["GET", "POST"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.headers.authorization);
    const pool = getPool();

    if (req.method === "POST") {
      const body = await readJson<MarkReadBody>(req);
      const ids = Array.isArray(body.ids)
        ? body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
        : [];

      if (ids.length > 0) {
        await pool.query(
          `update notifications
           set read_at = coalesce(read_at, now())
           where user_id = $1
             and id = any($2::bigint[])`,
          [session.userId, ids]
        );
      } else {
        await pool.query(
          `update notifications
           set read_at = coalesce(read_at, now())
           where user_id = $1
             and read_at is null`,
          [session.userId]
        );
      }

      return sendJson(res, 200, { success: true });
    }

    const url = getUrl(req);
    const limitRaw = Number(url.searchParams.get("limit") || "20");
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 20));

    const result = await pool.query(
      `select
         n.id,
         n.kind,
         n.entity_type,
         n.entity_id,
         n.title,
         n.body,
         n.link,
         n.read_at,
         n.created_at,
         u.username as actor_username,
         p.full_name as actor_full_name,
         p.avatar_url as actor_avatar_url
       from notifications n
       left join users u on u.id = n.actor_user_id
       left join profiles p on p.user_id = u.id
       where n.user_id = $1
       order by n.created_at desc
       limit $2`,
      [session.userId, limit]
    );

    return sendJson(res, 200, { notifications: result.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}
