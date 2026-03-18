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

type CreateEventBody = { title?: string; startsAt?: string; location?: string };

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
      const body = await readJson<CreateEventBody>(req);
      const title = (body.title || "").trim();
      const startsAt = body.startsAt ? new Date(body.startsAt) : null;
      const location = (body.location || "").trim() || null;
      if (!title) return sendJson(res, 400, { error: "Title required" });
      if (!startsAt || Number.isNaN(startsAt.getTime())) return sendJson(res, 400, { error: "Invalid startsAt" });

      const inserted = await pool.query(
        `insert into events (created_by, title, starts_at, location)
         values ($1,$2,$3,$4)
         returning id, title, starts_at, location, rsvp_count, created_at`,
        [session.userId, title, startsAt.toISOString(), location]
      );
      return sendJson(res, 201, { event: inserted.rows[0] });
    }

    const url = getUrl(req);
    const limitRaw = Number(url.searchParams.get("limit") || "10");
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 10));
    const from = url.searchParams.get("from");
    const fromDate = from ? new Date(from) : new Date();
    const fromIso = Number.isNaN(fromDate.getTime()) ? new Date().toISOString() : fromDate.toISOString();

    const result = await pool.query(
      `
      select id, title, starts_at, location, rsvp_count
      from events
      where starts_at >= $1
      order by starts_at asc
      limit ${limit}
      `,
      [fromIso]
    );

    const events = result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      startsAt: r.starts_at,
      location: r.location,
      rsvpCount: r.rsvp_count,
    }));

    return sendJson(res, 200, { events });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

