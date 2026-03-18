import "dotenv/config";
import express from "express";
import { registerUser, signInUser } from "../api/_lib/auth";
import { ensureSchema, getPool } from "../api/_lib/db";
import { getSessionFromAuthHeader } from "../api/_lib/session";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildPublicUrl, getBucket, getR2Client } from "../api/_lib/r2";

const app = express();
app.use(express.json());

app.post("/api/register", async (req, res) => {
  try {
    const { 
      email, username, password, 
      firstName, lastName, phone, dob, gender, aboutYou,
      favoriteSports, membershipType, plTeam, worldTeam,
      addressLine1, addressLine2, city, zipCode, country,
      bizType, bizName, regType
    } = req.body as {
      email?: string;
      username?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      dob?: string;
      gender?: string;
      aboutYou?: string;
      favoriteSports?: string | string[];
      membershipType?: string;
      plTeam?: string | string[];
      worldTeam?: string | string[];
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      zipCode?: string;
      country?: string;
      bizType?: string;
      bizName?: string;
      regType?: string;
    };
    const result = await registerUser({
      email: email || "",
      username: username || "",
      password: password || "",
      firstName,
      lastName,
      phone,
      dob,
      gender,
      aboutYou,
      favoriteSports,
      membershipType,
      plTeam,
      worldTeam,
      addressLine1,
      addressLine2,
      city,
      zipCode,
      country,
      bizType,
      bizName,
      regType,
    });
    return res.status(201).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Invalid input") {
      return res.status(400).json({
        error: "Invalid input",
        details: "email, username required; password must be at least 8 chars",
      });
    }
    if (message.toLowerCase().includes("duplicate key")) {
      return res.status(409).json({ error: "Email or username already exists" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/signin", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body as {
      emailOrUsername?: string;
      password?: string;
    };
    const result = await signInUser({
      emailOrUsername: emailOrUsername || "",
      password: password || "",
    });
    try {
      const pool = getPool();
      await pool.query(`update users set last_seen = now() where id = $1`, [result.user.id]);
    } catch {
      // best-effort
    }
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Invalid input") return res.status(400).json({ error: "Invalid input" });
    if (message === "Invalid credentials") {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    const userRes = await pool.query(`select id, email, username from users where id = $1 limit 1`, [
      session.userId,
    ]);
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const profileRes = await pool.query(
      `select user_id, full_name, role, company, bio, industry, favorite_sports, business_interests, looking_for, badges, cover_image_url, avatar_url, membership_tier, location, phone, dob, gender, about_you, privacy_settings, updated_at
       from profiles where user_id = $1 limit 1`,
      [session.userId]
    );
    const p = profileRes.rows[0] || null;

    return res.status(200).json({
      user,
      profile: p
        ? {
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
          }
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

async function upsertProfile(req: express.Request, res: express.Response) {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    const body = (req.body || {}) as {
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
      phone?: string;
      dob?: string;
      gender?: string;
      aboutYou?: string;
      plTeam?: string;
      worldTeam?: string;
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      zipCode?: string;
      country?: string;
      bizType?: string;
      bizName?: string;
      regType?: string;
      privacySettings?: Record<string, string>;
    };
    
    // Fetch existing profile to merge
    const existingRes = await pool.query("select * from profiles where user_id = $1", [session.userId]);
    const existing = existingRes.rows[0] || {};

    const merge = (key: string, bodyVal: any, existingVal: any) => {
      if (bodyVal !== undefined) return bodyVal;
      return existingVal !== undefined ? existingVal : null;
    };

    const membershipTier = (merge("membershipTier", body.membershipTier, existing.membership_tier) || "Gold").trim();
    const lookingFor = Array.isArray(body.lookingFor) ? body.lookingFor : (existing.looking_for || []);
    const badges = Array.isArray(body.badges) ? body.badges : (existing.badges || []);
    
    const defaultPrivacySettings = { phone: "only_me", email: "only_me", dob: "only_me", username: "only_me" };
    const privacySettings = { 
      ...defaultPrivacySettings, 
      ...(existing.privacy_settings || {}),
      ...(body.privacySettings || {}) 
    };

    const upsert = await pool.query(
      `insert into profiles
        (user_id, full_name, role, company, bio, industry, favorite_sports, business_interests, looking_for, badges, cover_image_url, avatar_url, membership_tier, location, phone, dob, gender, about_you, pl_team, world_team, address_line1, address_line2, city, zip_code, country, biz_type, biz_name, reg_type, privacy_settings, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,now())
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
         phone = excluded.phone,
         dob = excluded.dob,
         gender = excluded.gender,
         about_you = excluded.about_you,
         pl_team = excluded.pl_team,
         world_team = excluded.world_team,
         address_line1 = excluded.address_line1,
         address_line2 = excluded.address_line2,
         city = excluded.city,
         zip_code = excluded.zip_code,
         country = excluded.country,
         biz_type = excluded.biz_type,
         biz_name = excluded.biz_name,
         reg_type = excluded.reg_type,
         privacy_settings = excluded.privacy_settings,
         updated_at = now()
       returning *`,
      [
        session.userId,
        merge("fullName", body.fullName, existing.full_name),
        merge("role", body.role, existing.role),
        merge("company", body.company, existing.company),
        merge("bio", body.bio, existing.bio),
        merge("industry", body.industry, existing.industry),
        merge("favoriteSports", body.favoriteSports, existing.favorite_sports),
        merge("businessInterests", body.businessInterests, existing.business_interests),
        lookingFor,
        badges,
        merge("coverImageUrl", body.coverImageUrl, existing.cover_image_url),
        merge("avatarUrl", body.avatarUrl, existing.avatar_url),
        membershipTier,
        merge("location", body.location, existing.location),
        merge("phone", body.phone, existing.phone),
        merge("dob", body.dob, existing.dob),
        merge("gender", body.gender, existing.gender),
        merge("aboutYou", body.aboutYou, existing.about_you),
        merge("plTeam", body.plTeam, existing.pl_team),
        merge("worldTeam", body.worldTeam, existing.world_team),
        merge("addressLine1", body.addressLine1, existing.address_line1),
        merge("addressLine2", body.addressLine2, existing.address_line2),
        merge("city", body.city, existing.city),
        merge("zipCode", body.zipCode, existing.zip_code),
        merge("country", body.country, existing.country),
        merge("bizType", body.bizType, existing.biz_type),
        merge("bizName", body.bizName, existing.biz_name),
        merge("regType", body.regType, existing.reg_type),
        privacySettings,
      ]
    );

    const p = upsert.rows[0];
    return res.status(200).json({
      profile: {
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
        plTeam: p.pl_team,
        worldTeam: p.world_team,
        addressLine1: p.address_line1,
        addressLine2: p.address_line2,
        city: p.city,
        zipCode: p.zip_code,
        country: p.country,
        bizType: p.biz_type,
        bizName: p.biz_name,
        regType: p.reg_type,
        privacySettings: p.privacy_settings,
        updatedAt: p.updated_at,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
}

// Backwards-compatible: old route used by earlier frontend
app.put("/api/me/profile", upsertProfile);
// Current frontend uses PUT /api/me
app.put("/api/me", upsertProfile);

app.get("/api/profile/:username", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization")); // Optional session
    const pool = getPool();
    const { username } = req.params;

    const userRes = await pool.query(
      `select id, email, username from users where lower(username) = lower($1) limit 1`,
      [username]
    );
    const u = userRes.rows[0];
    if (!u) return res.status(404).json({ error: "User not found" });

    const profileRes = await pool.query(
      `select * from profiles where user_id = $1 limit 1`,
      [u.id]
    );
    const p = profileRes.rows[0];
    if (!p) return res.status(404).json({ error: "Profile not found" });

    const isOwner = session && session.userId === Number(u.id);
    const settings = p.privacy_settings || {};

    const checkVisible = (field: string) => {
      if (isOwner) return true;
      const val = settings[field] || "only_me";
      if (val === "all_members") return !!session.userId;
      if (val === "friends") return false; // Friends logic not implemented yet
      return false; // only_me
    };

    const profile = {
      userId: p.user_id,
      username: checkVisible("username") ? u.username : null,
      email: checkVisible("email") ? u.email : null,
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
      phone: checkVisible("phone") ? p.phone : null,
      dob: checkVisible("dob") ? p.dob : null,
      gender: p.gender,
      aboutYou: p.about_you,
      plTeam: p.pl_team,
      worldTeam: p.world_team,
      addressLine1: p.address_line1,
      addressLine2: p.address_line2,
      city: p.city,
      zipCode: p.zip_code,
      country: p.country,
      bizType: p.biz_type,
      bizName: p.biz_name,
      regType: p.reg_type,
      updatedAt: p.updated_at,
    };

    return res.status(200).json({ profile });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/online", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const limitRaw = Number(req.query.limit || 8);
    const limit = Math.max(1, Math.min(25, Number.isFinite(limitRaw) ? limitRaw : 8));
    const minutesRaw = Number(req.query.minutes || 15);
    const minutes = Math.max(1, Math.min(24 * 60, Number.isFinite(minutesRaw) ? minutesRaw : 15));
    const since = new Date(Date.now() - minutes * 60_000).toISOString();

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
    return res.status(200).json({ online, minutes });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/events", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const limitRaw = Number(req.query.limit || 10);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 10));
    const from = typeof req.query.from === "string" ? req.query.from : "";
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
    return res.status(200).json({ events });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/events", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const body = (req.body || {}) as { title?: string; startsAt?: string; location?: string };
    const title = String(body.title || "").trim();
    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const location = String(body.location || "").trim() || null;
    if (!title) return res.status(400).json({ error: "Title required" });
    if (!startsAt || Number.isNaN(startsAt.getTime())) return res.status(400).json({ error: "Invalid startsAt" });

    const inserted = await pool.query(
      `insert into events (created_by, title, starts_at, location)
       values ($1,$2,$3,$4)
       returning id, title, starts_at, location, rsvp_count, created_at`,
      [session.userId, title, startsAt.toISOString(), location]
    );
    return res.status(201).json({ event: inserted.rows[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/feed", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const filter = String(req.query.filter || "All").trim();
    const limitRaw = Number(req.query.limit || 30);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 30));

    const where: string[] = [];
    const params: unknown[] = [session.userId];
    if (filter && filter !== "All") {
      params.push(filter);
      where.push(`p.kind = $${params.length}`);
    }

    const result = await pool.query(
      `
      select
        p.id,
        p.kind,
        p.content,
        p.comment_count,
        (
          select coalesce(jsonb_object_agg(reaction_type, cnt), '{}'::jsonb)
          from (
            select reaction_type, count(*)::int as cnt from post_likes pl where pl.post_id = p.id group by reaction_type
          ) sub
        ) as reactions,
        (select reaction_type from post_likes pl where pl.post_id = p.id and pl.user_id = $1) as user_reaction,
        p.created_at,
        u.id as user_id,
        u.username,
        pr.full_name,
        pr.role,
        pr.company,
        pr.avatar_url
      from posts p
      join users u on u.id = p.user_id
      left join profiles pr on pr.user_id = u.id
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by p.created_at desc
      limit ${limit}
      `,
      params
    );

    const posts = result.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      content: r.content,
      reactions: r.reactions,
      userReaction: r.user_reaction || null,
      stats: { comments: r.comment_count },
      createdAt: r.created_at,
      author: {
        id: r.user_id,
        username: r.username,
        fullName: r.full_name,
        role: r.role,
        company: r.company,
        avatarUrl: r.avatar_url,
      },
    }));
    return res.status(200).json({ posts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/feed", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const body = (req.body || {}) as { kind?: "Post" | "Business" | "Events" | "Matches"; content?: string };
    const kind = String(body.kind || "Post").trim();
    const content = String(body.content || "").trim();
    if (!content) return res.status(400).json({ error: "Content required" });
    if (!["Post", "Business", "Events", "Matches"].includes(kind)) {
      return res.status(400).json({ error: "Invalid kind" });
    }

    const inserted = await pool.query(
      `insert into posts (user_id, kind, content) values ($1,$2,$3)
       returning id, kind, content, like_count, comment_count, created_at`,
      [session.userId, kind, content]
    );
    return res.status(201).json({ post: inserted.rows[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/feed/:id/react", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const postId = Number(req.params.id);
    const body = (req.body || {}) as { reaction?: string };
    const reaction = String(body.reaction || "like").trim();
    if (!postId) return res.status(400).json({ error: "Invalid post ID" });

    const allowed = new Set(["like", "love", "haha", "wow", "sad", "angry"]);
    if (!allowed.has(reaction)) return res.status(400).json({ error: "Invalid reaction" });

    await pool.query('BEGIN');
    await pool.query(
      `insert into post_likes (user_id, post_id, reaction_type) values ($1, $2, $3) 
       on conflict (user_id, post_id) do update set reaction_type = excluded.reaction_type returning 1`,
      [session.userId, postId, reaction]
    );
    await pool.query('COMMIT');
    return res.status(200).json({ success: true, reaction });
  } catch (e) {
    const pool = getPool();
    await pool.query('ROLLBACK').catch(() => {});
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.delete("/api/feed/:id/react", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const postId = Number(req.params.id);
    if (!postId) return res.status(400).json({ error: "Invalid post ID" });

    await pool.query('BEGIN');
    await pool.query(
      `delete from post_likes where user_id = $1 and post_id = $2 returning 1`,
      [session.userId, postId]
    );
    await pool.query('COMMIT');
    return res.status(200).json({ success: true });
  } catch (e) {
    const pool = getPool();
    await pool.query('ROLLBACK').catch(() => {});
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/feed/:id/comment", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const postId = Number(req.params.id);
    const body = (req.body || {}) as { content?: string; parentId?: number };
    const content = String(body.content || "").trim();
    const parentId = body.parentId ? Number(body.parentId) : null;
    if (!postId) return res.status(400).json({ error: "Invalid post ID" });
    if (!content) return res.status(400).json({ error: "Content required" });

    await pool.query('BEGIN');
    const inserted = await pool.query(
      `insert into post_comments (user_id, post_id, parent_id, content) values ($1, $2, $3, $4) returning id, content, created_at, parent_id`,
      [session.userId, postId, parentId, content]
    );
    await pool.query(`update posts set comment_count = comment_count + 1 where id = $1`, [postId]);
    await pool.query('COMMIT');

    const meRes = await pool.query(`
      select u.id, u.username, p.full_name, p.role, p.company, p.avatar_url 
      from users u left join profiles p on p.user_id = u.id where u.id = $1 limit 1
    `, [session.userId]);
    const me = meRes.rows[0];

    return res.status(201).json({ 
      comment: {
        id: inserted.rows[0].id,
        parentId: inserted.rows[0].parent_id,
        content: inserted.rows[0].content,
        createdAt: inserted.rows[0].created_at,
        author: {
          id: me.id,
          username: me.username,
          fullName: me.full_name,
          role: me.role,
          company: me.company,
          avatarUrl: me.avatar_url,
        }
      } 
    });
  } catch (e) {
    const pool = getPool();
    await pool.query('ROLLBACK').catch(() => {});
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/feed/:id/comments", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const postId = Number(req.params.id);
    if (!postId) return res.status(400).json({ error: "Invalid post ID" });

    const result = await pool.query(`
      select c.id, c.parent_id, c.content, c.created_at, u.id as user_id, u.username, p.full_name, p.role, p.company, p.avatar_url
      from post_comments c
      join users u on u.id = c.user_id
      left join profiles p on p.user_id = u.id
      where c.post_id = $1
      order by c.created_at asc
    `, [postId]);

    const comments = result.rows.map(r => ({
      id: r.id,
      parentId: r.parent_id,
      content: r.content,
      createdAt: r.created_at,
      author: {
        id: r.user_id,
        username: r.username,
        fullName: r.full_name,
        role: r.role,
        company: r.company,
        avatarUrl: r.avatar_url,
      }
    }));
    return res.status(200).json({ comments });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/dashboard", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const filter = String(req.query.filter || "All").trim();
    const feedLimitRaw = Number(req.query.feedLimit || 20);
    const feedLimit = Math.max(1, Math.min(50, Number.isFinite(feedLimitRaw) ? feedLimitRaw : 20));
    const sideLimitRaw = Number(req.query.sideLimit || 2);
    const sideLimit = Math.max(1, Math.min(10, Number.isFinite(sideLimitRaw) ? sideLimitRaw : 2));

    const meRes = await pool.query(`select id, email, username from users where id = $1 limit 1`, [
      session.userId,
    ]);
    const me = meRes.rows[0];
    if (!me) return res.status(401).json({ error: "Unauthorized" });

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
    const feedParams: unknown[] = [session.userId];
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
        p.comment_count,
        (
          select coalesce(jsonb_object_agg(reaction_type, cnt), '{}'::jsonb)
          from (
            select reaction_type, count(*)::int as cnt from post_likes pl where pl.post_id = p.id group by reaction_type
          ) sub
        ) as reactions,
        (select reaction_type from post_likes pl where pl.post_id = p.id and pl.user_id = $1) as user_reaction,
        p.created_at,
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
      reactions: r.reactions,
      userReaction: r.user_reaction || null,
      content: r.content,
      createdAt: r.created_at,
      stats: { comments: r.comment_count },
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
      select u.id, u.username, u.last_seen, p.full_name, p.avatar_url
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
      avatarUrl: r.avatar_url,
      lastSeen: r.last_seen,
    }));

    return res.status(200).json({
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
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/upload", async (req, res) => {
  try {
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const body = (req.body || {}) as {
      kind?: "avatar" | "cover" | "post";
      contentType?: string;
      filename?: string;
    };

    const contentType = (body.contentType || "").toLowerCase();
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
    ]);
    if (!allowed.has(contentType)) return res.status(400).json({ error: "Unsupported content type" });

    const ext =
      contentType === "image/jpeg"
        ? "jpg"
        : contentType === "image/png"
          ? "png"
          : contentType === "image/webp"
            ? "webp"
            : contentType === "image/gif"
              ? "gif"
              : contentType === "video/mp4"
                ? "mp4"
                : contentType === "video/webm"
                  ? "webm"
                  : "bin";

    const kind = body.kind || "post";
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const id =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis.crypto as any)?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const key = `uploads/${kind}/${session.userId}/${yyyy}/${mm}/${dd}/${id}.${ext}`;

    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: 60 }
    );

    const publicUrl = buildPublicUrl(key);
    return res.status(200).json({ key, uploadUrl, publicUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/members", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    const q = String(req.query.q || "").trim().toLowerCase();
    const industry = String(req.query.industry || "").trim().toLowerCase();
    const location = String(req.query.location || "").trim().toLowerCase();
    const sport = String(req.query.sport || "").trim().toLowerCase();
    const lookingFor = String(req.query.lookingFor || "").trim();
    const limitRaw = Number(req.query.limit || 24);
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

    return res.status(200).json({ members });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/bookings", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    const location = String(req.query.location || "").trim();
    const day = String(req.query.day || "").trim(); // YYYY-MM-DD

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

    return res.status(200).json({ attendingTonight, myBookings: myRes.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/bookings", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    const body = (req.body || {}) as {
      loungeLocation?: string;
      startTime?: string;
      guests?: number;
      area?: "Standard" | "VIP" | "Near Screen";
      matchName?: string;
      extras?: { preOrderDrinks?: boolean; foodPackage?: "None" | "Standard" | "Premium" };
    };

    const loungeLocation = String(body.loungeLocation || "").trim();
    const startTime = body.startTime ? new Date(body.startTime) : null;
    const guests = Number(body.guests || 0);
    const area = body.area || "Standard";
    const matchName = String(body.matchName || "").trim() || null;

    const allowedAreas = new Set(["Standard", "VIP", "Near Screen"]);
    const allowedGuests = new Set([2, 4, 6, 8]);
    if (!loungeLocation) return res.status(400).json({ error: "Location required" });
    if (!startTime || Number.isNaN(startTime.getTime())) return res.status(400).json({ error: "Invalid time" });
    if (!allowedGuests.has(guests)) return res.status(400).json({ error: "Invalid guests" });
    if (!allowedAreas.has(area)) return res.status(400).json({ error: "Invalid area" });

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

    return res.status(201).json({ booking: insert.rows[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/connect", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    const connections = await pool.query(
      `select u.id, u.username, p.full_name, p.avatar_url, p.role
       from connections c
       join users u on (u.id = c.requester_id or u.id = c.receiver_id) and u.id <> $1
       left join profiles p on p.user_id = u.id
       where (c.requester_id = $1 or c.receiver_id = $1) and c.status = 'accepted'`,
      [session.userId]
    );

    const pendingIncoming = await pool.query(
      `select u.id, u.username, p.full_name, p.avatar_url, p.role
       from connections c
       join users u on u.id = c.requester_id
       left join profiles p on p.user_id = u.id
       where c.receiver_id = $1 and c.status = 'pending'`,
      [session.userId]
    );

    const pendingOutgoing = await pool.query(
      `select u.id, u.username, p.full_name, p.avatar_url, p.role
       from connections c
       join users u on u.id = c.receiver_id
       left join profiles p on p.user_id = u.id
       where c.requester_id = $1 and c.status = 'pending'`,
      [session.userId]
    );

    return res.status(200).json({
      connections: connections.rows,
      pendingIncoming: pendingIncoming.rows,
      pendingOutgoing: pendingOutgoing.rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    return res.status(500).json({ error: msg });
  }
});

app.post("/api/connect", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: "targetId required" });
    const pool = getPool();

    await pool.query(
      `insert into connections (requester_id, receiver_id, status)
       values ($1, $2, 'pending')
       on conflict (requester_id, receiver_id) do nothing`,
      [session.userId, targetId]
    );
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.put("/api/connect", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId required" });
    const pool = getPool();

    await pool.query(
      `update connections set status = 'accepted'
       where requester_id = $1 and receiver_id = $2`,
      [requesterId, session.userId]
    );
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.delete("/api/connect", async (req, res) => {
  try {
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: "targetId required" });
    const pool = getPool();

    await pool.query(
      `delete from connections
       where (requester_id = $1 and receiver_id = $2)
          or (requester_id = $2 and receiver_id = $1)`,
      [session.userId, targetId]
    );
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.get("/api/messages", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    const result = await pool.query(
      `with last_messages as (
         select distinct on (conversation_id)
           id, sender_id, receiver_id, content, created_at, read_at,
           case when sender_id = $1 then receiver_id else sender_id end as other_id
         from messages
         cross join lateral (select least(sender_id, receiver_id) || '-' || greatest(sender_id, receiver_id) as conversation_id) c
         where sender_id = $1 or receiver_id = $1
         order by conversation_id, created_at desc
       )
       select lm.*, u.username, p.full_name, p.avatar_url
       from last_messages lm
       join users u on u.id = lm.other_id
       left join profiles p on p.user_id = u.id
       order by lm.created_at desc`,
      [session.userId]
    );
    return res.status(200).json({ conversations: result.rows });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.get("/api/messages/:userId", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const otherId = Number(req.params.userId);
    const pool = getPool();

    const result = await pool.query(
      `select * from messages
       where (sender_id = $1 and receiver_id = $2)
          or (sender_id = $2 and receiver_id = $1)
       order by created_at asc`,
      [session.userId, otherId]
    );

    // Mark as read
    await pool.query(
      `update messages set read_at = now()
       where sender_id = $1 and receiver_id = $2 and read_at is null`,
      [otherId, session.userId]
    );

    return res.status(200).json({ messages: result.rows });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

app.post("/api/messages", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const { receiverId, content } = req.body;
    if (!receiverId || !content) return res.status(400).json({ error: "receiverId and content required" });
    const pool = getPool();

    const result = await pool.query(
      `insert into messages (sender_id, receiver_id, content)
       values ($1, $2, $3)
       returning *`,
      [session.userId, receiverId, content]
    );
    return res.status(201).json({ message: result.rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : "Error" });
  }
});

const port = Number(process.env.API_PORT || 8787);
app.listen(port, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${port}`);
});
