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
    // Require auth so member directory stays private
    getSessionFromAuthHeader(req.headers.authorization);

    const url = getUrl(req);
    const pool = getPool();
    const username = url.searchParams.get("username");

    // Single Profile Fetch (mapped from /api/profile/:username)
    if (username) {
      const userRes = await pool.query(`select id, email, username from users where lower(username) = lower($1) limit 1`, [username]);
      const targetUser = userRes.rows[0];
      if (!targetUser) return sendJson(res, 404, { error: "User not found" });

      const profileRes = await pool.query(
        `select user_id, full_name, role, company, bio, industry, favorite_sports, business_interests, looking_for, badges, cover_image_url, avatar_url, membership_tier, location, phone, dob, gender, about_you, privacy_settings, updated_at
         from profiles where user_id = $1 limit 1`,
        [targetUser.id]
      );
      const p = profileRes.rows[0];

      // Connection status
      const session = getSessionFromAuthHeader(req.headers.authorization);
      let connStatus = "none";
      if (session && session.userId !== targetUser.id) {
        const connRes = await pool.query(
          `select * from connections
           where (requester_id = $1 and receiver_id = $2)
              or (requester_id = $2 and receiver_id = $1)`,
          [session.userId, targetUser.id]
        );
        const conn = connRes.rows[0];
        if (conn) {
          if (conn.status === "accepted") connStatus = "connected";
          else if (conn.requester_id === session.userId) connStatus = "pending_out";
          else connStatus = "pending_in";
        }
      }

      return sendJson(res, 200, {
        user: targetUser,
        profile: p ? {
          userId: p.user_id,
          fullName: p.full_name,
          role: p.role,
          company: p.company,
          bio: p.bio,
          industry: p.industry,
          favoriteSports: p.favorite_sports,
          businessInterests: p.business_interests,
          lookingFor: p.looking_for || [],
          badges: p.badges || [],
          coverImageUrl: p.cover_image_url,
          avatarUrl: p.avatar_url,
          membershipTier: p.membership_tier,
          location: p.location,
          phone: p.phone,
          dob: p.dob,
          gender: p.gender,
          aboutYou: p.about_you,
          privacySettings: p.privacy_settings,
          updatedAt: p.updated_at,
        } : null,
        connectionStatus: connStatus
      });
    }

    // Member Directory Listing
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const industry = (url.searchParams.get("industry") || "").trim().toLowerCase();
    const location = (url.searchParams.get("location") || "").trim().toLowerCase();
    const sport = (url.searchParams.get("sport") || "").trim().toLowerCase();
    const lookingFor = (url.searchParams.get("lookingFor") || "").trim();
    const limitRaw = Number(url.searchParams.get("limit") || "24");
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 24));

    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace(/\$X/g, `$${params.length}`));
    };

    if (q) {
      add(
        `(lower(coalesce(p.full_name,'')) like '%' || $X || '%' or lower(u.username) like '%' || $X || '%')`,
        q
      );
    }
    if (industry) add(`lower(coalesce(p.industry,'')) like '%' || $X || '%'`, industry);
    if (location) add(`lower(coalesce(p.location,'')) like '%' || $X || '%'`, location);
    if (sport) add(`lower(coalesce(p.favorite_sports,'')) like '%' || $X || '%'`, sport);
    if (lookingFor) add(`$X = any(coalesce(p.looking_for,'{}'))`, lookingFor);

    const result = await pool.query(
      `
      select
        u.id,
        u.username,
        u.email,
        p.full_name,
        p.role,
        p.company,
        p.industry,
        p.location,
        p.favorite_sports,
        p.membership_tier,
        p.avatar_url,
        p.looking_for
      from users u
      left join profiles p on p.user_id = u.id
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by u.id desc
      limit ${limit}
      `,
      params
    );

    const members = result.rows.map((r) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      role: r.role,
      company: r.company,
      industry: r.industry,
      location: r.location,
      favoriteSports: r.favorite_sports,
      membershipTier: r.membership_tier || "Gold",
      avatarUrl: r.avatar_url,
      lookingFor: r.looking_for || [],
    }));

    return sendJson(res, 200, { members });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

