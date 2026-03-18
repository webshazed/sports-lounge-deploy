import type { IncomingMessage, ServerResponse } from "node:http";
import { ensureSchema, getPool } from "./_lib/db.js";
import { getSessionFromAuthHeader } from "./_lib/session.js";
import { allowMethods, readJson, sendJson } from "./_lib/http.js";

type ProfileUpdate = {
  fullName?: string;
  role?: string;
  company?: string;
  bio?: string;
  industry?: string;
  favoriteSports?: string;
  businessInterests?: string;
  lookingFor?: string[];
  badges?: string[];
  coverImageUrl?: string;
  avatarUrl?: string;
  membershipTier?: string;
  location?: string;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "PUT") {
    allowMethods(res, ["GET", "PUT"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.headers.authorization);
    const pool = getPool();

    if (req.method === "GET") {
      const userRes = await pool.query(
        `select id, email, username from users where id = $1 limit 1`,
        [session.userId]
      );
      const user = userRes.rows[0];
      if (!user) return sendJson(res, 401, { error: "Unauthorized" });

      const profileRes = await pool.query(
        `select user_id, full_name, role, company, bio, industry, favorite_sports, business_interests, looking_for, badges, cover_image_url, avatar_url, membership_tier, location, updated_at
         from profiles
         where user_id = $1
         limit 1`,
        [session.userId]
      );
      const profile = profileRes.rows[0] || null;

      return sendJson(res, 200, {
        user,
        profile: profile
          ? {
              userId: profile.user_id,
              fullName: profile.full_name,
              role: profile.role,
              company: profile.company,
              bio: profile.bio,
              industry: profile.industry,
              favoriteSports: profile.favorite_sports,
              businessInterests: profile.business_interests,
              lookingFor: profile.looking_for || [],
              badges: profile.badges || [],
              coverImageUrl: profile.cover_image_url,
              avatarUrl: profile.avatar_url,
              membershipTier: profile.membership_tier,
              location: profile.location,
              updatedAt: profile.updated_at,
            }
          : null,
      });
    }

    // PUT: Merge-on-Write to preserve partial updates (e.g. avatar shouldn't wipe cover)
    const body = await readJson<ProfileUpdate>(req);
    
    // 1. Fetch existing
    const existingRes = await pool.query(`select * from profiles where user_id = $1`, [session.userId]);
    const existing = existingRes.rows[0] || {};

    // 2. Merge
    const merged = {
      fullName: body.fullName !== undefined ? body.fullName : existing.full_name,
      role: body.role !== undefined ? body.role : existing.role,
      company: body.company !== undefined ? body.company : existing.company,
      bio: body.bio !== undefined ? body.bio : existing.bio,
      industry: body.industry !== undefined ? body.industry : existing.industry,
      favoriteSports: body.favoriteSports !== undefined ? body.favoriteSports : existing.favorite_sports,
      businessInterests: body.businessInterests !== undefined ? body.businessInterests : existing.business_interests,
      lookingFor: body.lookingFor !== undefined ? body.lookingFor : (existing.looking_for || []),
      badges: body.badges !== undefined ? body.badges : (existing.badges || []),
      coverImageUrl: body.coverImageUrl !== undefined ? body.coverImageUrl : existing.cover_image_url,
      avatarUrl: body.avatarUrl !== undefined ? body.avatarUrl : existing.avatar_url,
      membershipTier: body.membershipTier !== undefined ? body.membershipTier : (existing.membership_tier || "Gold"),
      location: body.location !== undefined ? body.location : existing.location,
    };

    const upsert = await pool.query(
      `insert into profiles
        (user_id, full_name, role, company, bio, industry, favorite_sports, business_interests, looking_for, badges, cover_image_url, avatar_url, membership_tier, location, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
       on conflict (user_id) do update set
         full_name = excluded.full_name,
         role = excluded.role,
         company = excluded.company,
         bio = excluded.bio,
         industry = excluded.industry,
         favorite_sports = excluded.favorite_sports,
         business_interests = excluded.business_interests,
         looking_for = excluded.looking_for,
         badges = excluded.badges,
         cover_image_url = excluded.cover_image_url,
         avatar_url = excluded.avatar_url,
         membership_tier = excluded.membership_tier,
         location = excluded.location,
         updated_at = now()
       returning user_id, full_name, role, company, bio, industry, favorite_sports, business_interests, looking_for, badges, cover_image_url, avatar_url, membership_tier, location, updated_at`,
      [
        session.userId,
        merged.fullName || null,
        merged.role || null,
        merged.company || null,
        merged.bio || null,
        merged.industry || null,
        merged.favoriteSports || null,
        merged.businessInterests || null,
        merged.lookingFor,
        merged.badges,
        merged.coverImageUrl || null,
        merged.avatarUrl || null,
        merged.membershipTier,
        merged.location || null,
      ]
    );

    const profile = upsert.rows[0];
    return sendJson(res, 200, {
      profile: {
        userId: profile.user_id,
        fullName: profile.full_name,
        role: profile.role,
        company: profile.company,
        bio: profile.bio,
        industry: profile.industry,
        favoriteSports: profile.favorite_sports,
        businessInterests: profile.business_interests,
        lookingFor: profile.looking_for || [],
        badges: profile.badges || [],
        coverImageUrl: profile.cover_image_url,
        avatarUrl: profile.avatar_url,
        membershipTier: profile.membership_tier,
        location: profile.location,
        updatedAt: profile.updated_at,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized") return sendJson(res, 401, { error: "Unauthorized" });
    if (message.toLowerCase().includes("jwt")) return sendJson(res, 401, { error: "Unauthorized" });
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

