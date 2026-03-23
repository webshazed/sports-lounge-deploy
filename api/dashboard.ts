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

type FeedFilter = "All" | "Business" | "Events" | "Matches";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    allowMethods(res, ["GET"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.headers.authorization);
    const pool = getPool();

    const url = getUrl(req);
    const filter = (url.searchParams.get("filter") || "All").trim() as FeedFilter;
    const feedLimitRaw = Number(url.searchParams.get("feedLimit") || "20");
    const feedLimit = Math.max(1, Math.min(50, Number.isFinite(feedLimitRaw) ? feedLimitRaw : 20));
    const sideLimitRaw = Number(url.searchParams.get("sideLimit") || "2");
    const sideLimit = Math.max(1, Math.min(10, Number.isFinite(sideLimitRaw) ? sideLimitRaw : 2));

    const meRes = await pool.query(`select id, email, username from users where id = $1 limit 1`, [
      session.userId,
    ]);
    const me = meRes.rows[0];
    if (!me) return sendJson(res, 401, { error: "Unauthorized" });

    const profileRes = await pool.query(
      `select membership_tier, avatar_url, full_name, role, company from profiles where user_id = $1 limit 1`,
      [session.userId]
    );
    const profile = profileRes.rows[0] || null;

    const memberCountRes = await pool.query(`select count(*)::int as c from users`);
    const connections = Math.max(0, (memberCountRes.rows[0]?.c || 0) - 1);

    const postsCountRes = await pool.query(`select count(*)::int as c from posts where user_id = $1`, [
      session.userId,
    ]);
    const posts = postsCountRes.rows[0]?.c || 0;

    const upcomingEventCountRes = await pool.query(`select count(*)::int as c from events where starts_at >= now()`);
    const events = upcomingEventCountRes.rows[0]?.c || 0;

    const feedWhere: string[] = [];
    const feedParams: unknown[] = [];
    if (filter && filter !== "All") {
      feedParams.push(filter);
      feedWhere.push(`p.kind = $${feedParams.length}`);
    }
    const feedRes = await pool.query(
      `
      select
        p.id,
        p.kind,
        p.content,
        p.like_count,
        p.comment_count,
        p.created_at,
        p.media_url,
        p.media_type,
        u.id as user_id,
        u.username,
        pr.full_name,
        pr.role,
        pr.company,
        pr.avatar_url
      from posts p
      join users u on u.id = p.user_id
      left join profiles pr on pr.user_id = u.id
      ${feedWhere.length ? `where ${feedWhere.join(" and ")}` : ""}
      order by p.created_at desc
      limit ${feedLimit}
      `,
      feedParams
    );
    const feed = feedRes.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      content: r.content,
      createdAt: r.created_at,
      stats: { likes: r.like_count, comments: r.comment_count },
      mediaUrl: r.media_url,
      mediaType: r.media_type,
      author: {
        id: r.user_id,
        username: r.username,
        fullName: r.full_name,
        role: r.role,
        company: r.company,
        avatarUrl: r.avatar_url,
      },
    }));

    const eventsRes = await pool.query(
      `
      select id, title, starts_at, location, rsvp_count
      from events
      where starts_at >= now()
      order by starts_at asc
      limit ${sideLimit}
      `
    );
    const upcomingEvents = eventsRes.rows.map((r) => ({
      id: r.id,
      title: r.title,
      startsAt: r.starts_at,
      location: r.location,
      rsvpCount: r.rsvp_count,
    }));

    const suggestRes = await pool.query(
      `
      select u.id, u.username, p.full_name, p.role, p.avatar_url
      from users u
      left join profiles p on p.user_id = u.id
      where u.id <> $1
      order by u.last_seen desc
      limit ${sideLimit}
      `,
      [session.userId]
    );
    const suggested = suggestRes.rows.map((r) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      role: r.role,
      avatarUrl: r.avatar_url,
    }));

    const onlineRes = await pool.query(
      `
      select u.id, u.username, u.last_seen, p.full_name
      from users u
      left join profiles p on p.user_id = u.id
      where u.last_seen >= (now() - interval '15 minutes')
      order by u.last_seen desc
      limit 12
      `
    );
    const onlineNow = onlineRes.rows.map((r) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      lastSeen: r.last_seen,
    }));

    return sendJson(res, 200, {
      me: {
        id: me.id,
        email: me.email,
        username: me.username,
        membershipTier: profile?.membership_tier || "Gold",
        avatarUrl: profile?.avatar_url || null,
        fullName: profile?.full_name || null,
        role: profile?.role || null,
        company: profile?.company || null,
      },
      stats: { connections, events, posts },
      feed,
      upcomingEvents,
      suggested,
      onlineNow,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

