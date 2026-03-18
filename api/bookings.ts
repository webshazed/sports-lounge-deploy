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

type CreateBookingBody = {
  loungeLocation?: string;
  startTime?: string; // ISO
  guests?: number;
  area?: "Standard" | "VIP" | "Near Screen";
  matchName?: string;
  extras?: {
    preOrderDrinks?: boolean;
    foodPackage?: "None" | "Standard" | "Premium";
  };
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

    if (req.method === "GET") {
      const url = getUrl(req);
      const location = (url.searchParams.get("location") || "").trim();
      const day = (url.searchParams.get("day") || "").trim(); // YYYY-MM-DD

      let attendingTonight = 0;
      if (location && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
        const start = new Date(`${day}T00:00:00.000Z`);
        const end = new Date(`${day}T23:59:59.999Z`);
        const countRes = await pool.query(
          `select count(*)::int as c
           from lounge_bookings
           where lounge_location = $1
             and start_time >= $2
             and start_time <= $3`,
          [location, start.toISOString(), end.toISOString()]
        );
        attendingTonight = countRes.rows[0]?.c || 0;
      }

      const myRes = await pool.query(
        `select id, lounge_location, start_time, guests, area, match_name, extras, created_at
         from lounge_bookings
         where user_id = $1
         order by start_time desc
         limit 10`,
        [session.userId]
      );

      return sendJson(res, 200, { attendingTonight, myBookings: myRes.rows });
    }

    // POST
    const body = await readJson<CreateBookingBody>(req);
    const loungeLocation = (body.loungeLocation || "").trim();
    const startTime = body.startTime ? new Date(body.startTime) : null;
    const guests = Number(body.guests || 0);
    const area = body.area || "Standard";
    const matchName = (body.matchName || "").trim() || null;

    const allowedAreas = new Set(["Standard", "VIP", "Near Screen"]);
    const allowedGuests = new Set([2, 4, 6, 8]);
    if (!loungeLocation) return sendJson(res, 400, { error: "Location required" });
    if (!startTime || Number.isNaN(startTime.getTime())) return sendJson(res, 400, { error: "Invalid time" });
    if (!allowedGuests.has(guests)) return sendJson(res, 400, { error: "Invalid guests" });
    if (!allowedAreas.has(area)) return sendJson(res, 400, { error: "Invalid area" });

    const extras = body.extras || {};
    const extrasJson = {
      preOrderDrinks: Boolean(extras.preOrderDrinks),
      foodPackage: extras.foodPackage || "None",
    };

    const insert = await pool.query(
      `insert into lounge_bookings (user_id, lounge_location, start_time, guests, area, match_name, extras)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id, lounge_location, start_time, guests, area, match_name, extras, created_at`,
      [
        session.userId,
        loungeLocation,
        startTime.toISOString(),
        guests,
        area,
        matchName,
        JSON.stringify(extrasJson),
      ]
    );

    return sendJson(res, 201, { booking: insert.rows[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

