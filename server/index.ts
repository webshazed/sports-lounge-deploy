import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { registerUser, signInUser } from "../api/_lib/auth";
import { ensureSchema, getPool } from "../api/_lib/db";
import { getSessionFromAuthHeader } from "../api/_lib/session";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "dev-insecure-secret";
  throw new Error("Missing JWT_SECRET env var");
}
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildPublicUrl, getBucket, getR2Client } from "../api/_lib/r2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../dist")));

app.post("/api/register", async (req, res) => {
  try {
    const body = req.body || {};
    const result = await registerUser({
      email: body.email || "",
      username: body.username || "",
      password: body.password || "",
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      dob: body.dob,
      gender: body.gender,
      aboutYou: body.aboutYou,
      regType: body.regType,
      favoriteSports: body.favoriteSports,
      membershipType: body.membershipType,
      plTeam: body.plTeam,
      worldTeam: body.worldTeam,
      addressLine1: body.addressLine1,
      addressLine2: body.addressLine2,
      city: body.city,
      zipCode: body.zipCode,
      country: body.country,
      bizType: body.bizType,
      bizName: body.bizName,
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

// ─── Stripe Checkout ─────────────────────────────────
app.post("/api/checkout", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const { getStripe, PLANS } = await import("../api/_lib/stripe");
    type PlanType = keyof typeof PLANS;
    const planType = (req.body?.planType || "individual") as PlanType;

    if (!PLANS[planType]) {
      return res.status(400).json({ error: "Invalid plan type" });
    }

    const plan = PLANS[planType];
    const stripe = getStripe();

    // Get user email
    const userRes = await pool.query(`select email from users where id=$1`, [session.userId]);
    const email = userRes.rows[0]?.email;

    // Create or reuse Stripe Customer
    let customerId: string | undefined;
    const subRes = await pool.query(
      `select stripe_customer_id from subscriptions where user_id=$1 and stripe_customer_id is not null limit 1`,
      [session.userId]
    );
    if (subRes.rows[0]?.stripe_customer_id) {
      customerId = subRes.rows[0].stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId: String(session.userId) },
      });
      customerId = customer.id;
    }

    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "") || "http://localhost:5173";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: plan.name, description: plan.description },
            unit_amount: plan.price,
            recurring: { interval: plan.interval },
          },
          quantity: 1,
        },
      ],
      metadata: { userId: String(session.userId), planType },
      success_url: `${origin}/membership?status=success`,
      cancel_url: `${origin}/membership?status=cancelled`,
    });

    return res.status(200).json({ sessionUrl: checkoutSession.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ─── Subscription Status ─────────────────────────────
app.get("/api/subscription", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    const subRes = await pool.query(
      `select id, plan_type, price_amount, status, stripe_subscription_id, current_period_end, created_at
       from subscriptions where user_id = $1 order by created_at desc limit 1`,
      [session.userId]
    );

    const sub = subRes.rows[0];
    const profRes = await pool.query(`select reg_type from profiles where user_id=$1`, [session.userId]);
    const regType = profRes.rows[0]?.reg_type || "individual";

    if (!sub) {
      return res.status(200).json({ subscription: null, regType });
    }

    return res.status(200).json({
      subscription: {
        id: sub.id,
        planType: sub.plan_type,
        priceAmount: sub.price_amount,
        status: sub.status,
        stripeSubscriptionId: sub.stripe_subscription_id,
        currentPeriodEnd: sub.current_period_end,
        createdAt: sub.created_at,
      },
      regType,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ─── Stripe Webhook ──────────────────────────────────
app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    await ensureSchema();
    const pool = getPool();
    const { getStripe } = await import("../api/_lib/stripe");
    const stripe = getStripe();

    let event;
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret && sig) {
      const rawBody = typeof req.body === "string" ? req.body : req.body.toString();
      event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
    } else {
      event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object;
        const userId = s.metadata?.userId;
        const planType = s.metadata?.planType || "individual";
        if (userId) {
          const priceMap: Record<string, number> = { individual: 1999, company_small: 2999, company_medium: 3999, company_large: 4999 };
          await pool.query(
            `insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan_type, price_amount, status, current_period_end, updated_at)
             values ($1,$2,$3,$4,$5,'active',now()+interval '30 days',now())
             on conflict on constraint subscriptions_pkey do nothing`,
            [userId, s.customer, s.subscription, planType, priceMap[planType] || 1999]
          );
          // Also update if existing pending record
          await pool.query(
            `update subscriptions set stripe_customer_id=$1, stripe_subscription_id=$2, plan_type=$3, price_amount=$4, status='active', current_period_end=now()+interval '30 days', updated_at=now()
             where user_id=$5 and status != 'active'`,
            [s.customer, s.subscription, planType, priceMap[planType] || 1999, userId]
          );
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : sub.status === "canceled" ? "cancelled" : sub.status;
        const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        await pool.query(`update subscriptions set status=$1, current_period_end=$2, updated_at=now() where stripe_subscription_id=$3`, [status, periodEnd, sub.id]);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await pool.query(`update subscriptions set status='cancelled', updated_at=now() where stripe_subscription_id=$1`, [sub.id]);
        break;
      }
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Webhook error:", message);
    return res.status(400).json({ error: "Webhook error", details: message });
  }
});

// ─── Token Refresh ───────────────────────────────────
app.post("/api/refresh", async (req, res) => {
  try {
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    // Verify user still exists
    const userRes = await pool.query(
      `select id, email, username from users where id = $1 limit 1`,
      [session.userId]
    );
    const user = userRes.rows[0];
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Issue a fresh token
    const newToken = jwt.sign(
      { sub: String(user.id), id: user.id, email: user.email, username: user.username },
      getJwtSecret(),
      { expiresIn: "7d" }
    );

    // Update last_seen
    try {
      await pool.query(`update users set last_seen = now() where id = $1`, [user.id]);
    } catch {
      // best-effort
    }

    return res.status(200).json({
      token: newToken,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return res.status(401).json({ error: "Unauthorized" });
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
      `select user_id, full_name, role, company, bio, industry, favorite_sports, business_interests, looking_for, badges, cover_image_url, avatar_url, membership_tier, location, updated_at
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
      username?: string;
      email?: string;
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

    // Update users table first if username or email provided
    if (body.username || body.email) {
      // Check for uniqueness if changing
      const uRes = await pool.query(`select email, username from users where id=$1`, [session.userId]);
      const u = uRes.rows[0];
      const newEmail = body.email ? body.email.trim().toLowerCase() : u.email;
      const newUsername = body.username ? body.username.trim() : u.username;

      if (newEmail !== u.email || newUsername !== u.username) {
        try {
          await pool.query(
            `update users set email=$1, username=$2 where id=$3`,
            [newEmail, newUsername, session.userId]
          );
        } catch (err: any) {
          if (err.message?.toLowerCase().includes("duplicate key")) {
            return res.status(409).json({ error: "Email or username already in use" });
          }
          throw err;
        }
      }
    }

    // Read existing profile to merge
    const existingRes = await pool.query(`select * from profiles where user_id=$1`, [session.userId]);
    const existing = existingRes.rows[0] || {};

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

    // If favoriteSports or businessInterests are arrays (e.g. from registration), join them
    let favSports = merged.favoriteSports;
    if (Array.isArray(favSports)) favSports = favSports.join(", ");
    let bizInt = merged.businessInterests;
    if (Array.isArray(bizInt)) bizInt = bizInt.join(", ");

    const lookingFor = Array.isArray(merged.lookingFor) ? merged.lookingFor : [];
    const badges = Array.isArray(merged.badges) ? merged.badges : [];

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
        favSports || null,
        bizInt || null,
        lookingFor,
        badges,
        merged.coverImageUrl || null,
        merged.avatarUrl || null,
        merged.membershipTier,
        merged.location || null,
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
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const limitRaw = Number(req.query.limit || 10);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 10));
    const from = typeof req.query.from === "string" ? req.query.from : "";
    const fromDate = from ? new Date(from) : new Date();
    const fromIso = Number.isNaN(fromDate.getTime()) ? new Date().toISOString() : fromDate.toISOString();

    const result = await pool.query(
      `
      select e.id, e.title, e.starts_at, e.location, e.rsvp_count,
             case when er.user_id is not null then true else false end as my_rsvp
      from events e
      left join event_rsvps er on er.event_id = e.id and er.user_id = $2
      where e.starts_at >= $1
      order by e.starts_at asc
      limit ${limit}
      `,
      [fromIso, session.userId]
    );

    const events = result.rows.map((r) => ({
      id: r.id,
      title: r.title,
      startsAt: r.starts_at,
      location: r.location,
      rsvpCount: r.rsvp_count,
      myRsvp: r.my_rsvp,
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
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const filter = String(req.query.filter || "All").trim();
    const limitRaw = Number(req.query.limit || 30);
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 30));

    const where: string[] = [];
    const params: unknown[] = [];
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
      stats: { likes: r.like_count, comments: r.comment_count },
      createdAt: r.created_at,
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
    const body = (req.body || {}) as {
      kind?: "Post" | "Business" | "Events" | "Matches";
      content?: string;
      mediaUrl?: string;
      mediaType?: string;
    };
    const kind = String(body.kind || "Post").trim();
    const content = String(body.content || "").trim();
    const mediaUrl = String(body.mediaUrl || "").trim() || null;
    const mediaType = String(body.mediaType || "").trim() || null;
    if (!content && !mediaUrl) return res.status(400).json({ error: "Content or media required" });
    if (!["Post", "Business", "Events", "Matches"].includes(kind)) {
      return res.status(400).json({ error: "Invalid kind" });
    }

    const inserted = await pool.query(
      `insert into posts (user_id, kind, content, media_url, media_type)
       values ($1,$2,$3,$4,$5)
       returning id, kind, content, like_count, comment_count, created_at, media_url, media_type`,
      [session.userId, kind, content || "", mediaUrl, mediaType]
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
        pr.avatar_url,
        case when pl.user_id is not null then true else false end as my_like,
        case when ps.user_id is not null then true else false end as my_save
      from posts p
      join users u on u.id = p.user_id
      left join profiles pr on pr.user_id = u.id
      left join post_likes pl on pl.post_id = p.id and pl.user_id = $1
      left join post_saves ps on ps.post_id = p.id and ps.user_id = $1
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
      myLike: r.my_like,
      mySave: r.my_save,
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

// ── Like / Unlike a post ──────────────────────────────────────────────────────
app.post("/api/feed/:id/like", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const postId = Number(req.params.id);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });

    // Toggle: try insert; if conflict then delete
    const existing = await pool.query(
      `select 1 from post_likes where user_id=$1 and post_id=$2`,
      [session.userId, postId]
    );
    if (existing.rows.length > 0) {
      await pool.query(`delete from post_likes where user_id=$1 and post_id=$2`, [session.userId, postId]);
      await pool.query(`update posts set like_count = greatest(0, like_count - 1) where id=$1`, [postId]);
      const cnt = await pool.query(`select like_count from posts where id=$1`, [postId]);
      return res.status(200).json({ liked: false, likeCount: cnt.rows[0]?.like_count ?? 0 });
    } else {
      await pool.query(`insert into post_likes(user_id,post_id) values($1,$2) on conflict do nothing`, [session.userId, postId]);
      await pool.query(`update posts set like_count = like_count + 1 where id=$1`, [postId]);
      const cnt = await pool.query(`select like_count from posts where id=$1`, [postId]);
      return res.status(200).json({ liked: true, likeCount: cnt.rows[0]?.like_count ?? 0 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Save / Unsave a post ──────────────────────────────────────────────────────
app.post("/api/feed/:id/save", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const postId = Number(req.params.id);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });

    const existing = await pool.query(
      `select 1 from post_saves where user_id=$1 and post_id=$2`,
      [session.userId, postId]
    );
    if (existing.rows.length > 0) {
      await pool.query(`delete from post_saves where user_id=$1 and post_id=$2`, [session.userId, postId]);
      return res.status(200).json({ saved: false });
    } else {
      await pool.query(`insert into post_saves(user_id,post_id) values($1,$2) on conflict do nothing`, [session.userId, postId]);
      return res.status(200).json({ saved: true });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Saved posts ───────────────────────────────────────────────────────────────
app.get("/api/saved", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const result = await pool.query(
      `select p.id, p.kind, p.content, p.like_count, p.comment_count, p.media_url, p.media_type, p.media_urls, p.created_at,
              u.id as user_id, u.username, pr.full_name, pr.role, pr.company, pr.avatar_url
       from post_saves s
       join posts p on p.id = s.post_id
       join users u on u.id = p.user_id
       left join profiles pr on pr.user_id = u.id
       where s.user_id = $1
       order by s.created_at desc
       limit 50`,
      [session.userId]
    );
    const posts = result.rows.map((r) => ({
      id: r.id, kind: r.kind, content: r.content,
      stats: { likes: r.like_count, comments: r.comment_count },
      mediaUrl: r.media_url, mediaType: r.media_type, mediaUrls: r.media_urls || [],
      createdAt: r.created_at,
      author: { id: r.user_id, username: r.username, fullName: r.full_name, role: r.role, company: r.company, avatarUrl: r.avatar_url },
    }));
    return res.status(200).json({ posts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Leaderboard ───────────────────────────────────────────────────────────────
app.get("/api/leaderboard", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const result = await pool.query(
      `select u.id, u.username,
              p.full_name, p.avatar_url, p.membership_tier, p.role, p.company,
              coalesce(pc.post_count,0) as post_count,
              coalesce(lk.like_count,0) as like_count,
              coalesce(ev.event_count,0) as event_count
       from users u
       left join profiles p on p.user_id = u.id
       left join (select user_id, count(*)::int as post_count from posts group by user_id) pc on pc.user_id = u.id
       left join (select p2.user_id, coalesce(sum(p2.like_count),0)::int as like_count from posts p2 group by p2.user_id) lk on lk.user_id = u.id
       left join (select user_id, count(*)::int as event_count from event_rsvps group by user_id) ev on ev.user_id = u.id
       order by (coalesce(pc.post_count,0)*3 + coalesce(lk.like_count,0)*2 + coalesce(ev.event_count,0)*5) desc
       limit 50`
    );
    const members = result.rows.map((r, i) => ({
      rank: i + 1,
      id: r.id, username: r.username, fullName: r.full_name,
      avatarUrl: r.avatar_url, membershipTier: r.membership_tier || "Gold",
      role: r.role, company: r.company,
      postCount: r.post_count, likeCount: r.like_count, eventCount: r.event_count,
      score: r.post_count * 3 + r.like_count * 2 + r.event_count * 5,
    }));
    return res.status(200).json({ members });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Live Matches ──────────────────────────────────────────────────────────────
app.get("/api/live-matches", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();

    // Seed sample matches if table is empty
    const countRes = await pool.query(`select count(*)::int as c from live_matches`);
    if (countRes.rows[0].c === 0) {
      const now = new Date();
      const fixtures = [
        { title: "Premier League", sport: "Football", home: "Manchester City", away: "Arsenal", sh: 2, sa: 1, status: "live", offset: -45 },
        { title: "La Liga", sport: "Football", home: "Real Madrid", away: "Barcelona", sh: 0, sa: 0, status: "upcoming", offset: 60 },
        { title: "Champions League", sport: "Football", home: "Bayern Munich", away: "PSG", sh: 1, sa: 1, status: "live", offset: -20 },
        { title: "ATP Masters", sport: "Tennis", home: "Djokovic", away: "Alcaraz", sh: 1, sa: 1, status: "live", offset: -90 },
        { title: "IPL T20", sport: "Cricket", home: "Mumbai Indians", away: "CSK", sh: 0, sa: 0, status: "upcoming", offset: 120 },
        { title: "NBA Playoffs", sport: "Basketball", home: "Warriors", away: "Lakers", sh: 0, sa: 0, status: "upcoming", offset: 180 },
        { title: "Serie A", sport: "Football", home: "AC Milan", away: "Juventus", sh: 0, sa: 0, status: "upcoming", offset: 240 },
        { title: "Bundesliga", sport: "Football", home: "Dortmund", away: "Leverkusen", sh: 3, sa: 2, status: "finished", offset: -120 },
      ];
      for (const f of fixtures) {
        const startsAt = new Date(now.getTime() + f.offset * 60_000);
        await pool.query(
          `insert into live_matches(title,sport,team_home,team_away,score_home,score_away,status,starts_at,venue) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing`,
          [f.title, f.sport, f.home, f.away, f.sh, f.sa, f.status, startsAt.toISOString(), "Sports Lounge"]
        );
      }
    }

    const result = await pool.query(
      `select lm.*, coalesce(mr.c,0) as my_rsvp
       from live_matches lm
       left join (select match_id, 1 as c from match_rsvps where user_id=$1) mr on mr.match_id = lm.id
       order by case status when 'live' then 0 when 'upcoming' then 1 else 2 end, starts_at asc
       limit 30`,
      [session.userId]
    );
    return res.status(200).json({ matches: result.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Match RSVP (watch party) ──────────────────────────────────────────────────
app.post("/api/live-matches/:id/rsvp", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const matchId = Number(req.params.id);
    if (!matchId) return res.status(400).json({ error: "Invalid match id" });

    const existing = await pool.query(`select 1 from match_rsvps where user_id=$1 and match_id=$2`, [session.userId, matchId]);
    if (existing.rows.length > 0) {
      await pool.query(`delete from match_rsvps where user_id=$1 and match_id=$2`, [session.userId, matchId]);
      await pool.query(`update live_matches set watch_party_count = greatest(0, watch_party_count - 1) where id=$1`, [matchId]);
      return res.status(200).json({ rsvped: false });
    } else {
      await pool.query(`insert into match_rsvps(user_id,match_id) values($1,$2) on conflict do nothing`, [session.userId, matchId]);
      await pool.query(`update live_matches set watch_party_count = watch_party_count + 1 where id=$1`, [matchId]);
      return res.status(200).json({ rsvped: true });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Business Hub ──────────────────────────────────────────────────────────────
app.get("/api/business", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const category = String(req.query.category || "").trim();
    const where = category && category !== "All" ? `where bp.category = $1` : "";
    const params = category && category !== "All" ? [category] : [];
    const result = await pool.query(
      `select bp.id, bp.category, bp.title, bp.description, bp.contact, bp.created_at,
              u.id as user_id, u.username, p.full_name, p.avatar_url, p.role, p.company
       from business_posts bp
       join users u on u.id = bp.user_id
       left join profiles p on p.user_id = u.id
       ${where}
       order by bp.created_at desc
       limit 50`,
      params
    );
    return res.status(200).json({ posts: result.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/business", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const body = (req.body || {}) as { category?: string; title?: string; description?: string; contact?: string };
    const category = String(body.category || "Opportunity").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const contact = String(body.contact || "").trim() || null;
    if (!title || !description) return res.status(400).json({ error: "Title and description required" });
    const inserted = await pool.query(
      `insert into business_posts(user_id,category,title,description,contact) values($1,$2,$3,$4,$5) returning *`,
      [session.userId, category, title, description, contact]
    );
    return res.status(201).json({ post: inserted.rows[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Events RSVP ───────────────────────────────────────────────────────────────
app.post("/api/events/:id/rsvp", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const eventId = Number(req.params.id);
    if (!eventId) return res.status(400).json({ error: "Invalid event id" });

    const existing = await pool.query(`select 1 from event_rsvps where user_id=$1 and event_id=$2`, [session.userId, eventId]);
    if (existing.rows.length > 0) {
      await pool.query(`delete from event_rsvps where user_id=$1 and event_id=$2`, [session.userId, eventId]);
      await pool.query(`update events set rsvp_count = greatest(0, rsvp_count - 1) where id=$1`, [eventId]);
      return res.status(200).json({ rsvped: false });
    } else {
      await pool.query(`insert into event_rsvps(user_id,event_id) values($1,$2) on conflict do nothing`, [session.userId, eventId]);
      await pool.query(`update events set rsvp_count = rsvp_count + 1 where id=$1`, [eventId]);
      return res.status(200).json({ rsvped: true });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Public profile by username ────────────────────────────────────────────────
app.get("/api/profile/:username", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const username = req.params.username;
    const userRes = await pool.query(`select id, username from users where username=$1 limit 1`, [username]);
    if (!userRes.rows[0]) return res.status(404).json({ error: "User not found" });
    const u = userRes.rows[0];
    const profileRes = await pool.query(
      `select full_name, role, company, bio, industry, favorite_sports, business_interests, looking_for, badges, cover_image_url, avatar_url, membership_tier, location from profiles where user_id=$1`,
      [u.id]
    );
    const p = profileRes.rows[0] || {};
    const postCount = (await pool.query(`select count(*)::int as c from posts where user_id=$1`, [u.id])).rows[0]?.c || 0;
    return res.status(200).json({
      user: { id: u.id, username: u.username },
      profile: {
        fullName: p.full_name || "",
        role: p.role || "",
        company: p.company || "",
        bio: p.bio || "",
        industry: p.industry || "",
        favoriteSports: p.favorite_sports || "",
        businessInterests: p.business_interests || "",
        lookingFor: Array.isArray(p.looking_for) ? p.looking_for : [],
        badges: Array.isArray(p.badges) ? p.badges : [],
        coverImageUrl: p.cover_image_url || "",
        avatarUrl: p.avatar_url || "",
        membershipTier: p.membership_tier || "Gold",
        location: p.location || "",
      },
      postCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── User posts ────────────────────────────────────────────────────────────────
app.get("/api/users/:id/posts", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const userId = Number(req.params.id);
    const result = await pool.query(
      `select p.id, p.kind, p.content, p.like_count, p.comment_count, p.media_url, p.media_type, p.media_urls, p.created_at
       from posts p where p.user_id=$1 order by p.created_at desc limit 50`,
      [userId]
    );
    return res.status(200).json({ posts: result.rows.map((r) => ({ ...r, mediaUrls: r.media_urls || [] })) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Messages (DM) ─────────────────────────────────────────────────────────────
app.get("/api/messages", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const conversations = await pool.query(
      `with latest_msgs as (
        select distinct on (least(sender_id, receiver_id), greatest(sender_id, receiver_id))
          id, sender_id, receiver_id, content, created_at, read_at,
          case when sender_id=$1 then receiver_id else sender_id end as interactant_id
        from messages
        where sender_id=$1 or receiver_id=$1
        order by least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at desc
      )
      select l.id, l.interactant_id as other_id, l.content, l.created_at, l.read_at,
             u.username, p.full_name, p.avatar_url
      from latest_msgs l
      join users u on u.id = l.interactant_id
      left join profiles p on p.user_id = u.id
      order by l.created_at desc`,
      [session.userId]
    );
    return res.status(200).json({ conversations: conversations.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/messages/:userId", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const otherId = Number(req.params.userId);
    const history = await pool.query(
      `select id, sender_id, receiver_id, content, created_at, read_at
       from messages
       where (sender_id=$1 and receiver_id=$2) or (sender_id=$2 and receiver_id=$1)
       order by created_at asc
       limit 200`,
      [session.userId, otherId]
    );
    // Mark as read
    await pool.query(
      `update messages set read_at=now() where receiver_id=$1 and sender_id=$2 and read_at is null`,
      [session.userId, otherId]
    );
    return res.status(200).json({ messages: history.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/messages", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const body = req.body as { receiverId?: number; content?: string };
    const receiverId = Number(body.receiverId);
    const content = String(body.content || "").trim();
    if (!receiverId || !content) return res.status(400).json({ error: "receiverId and content required" });
    const inserted = await pool.query(
      `insert into messages(sender_id,receiver_id,content) values($1,$2,$3) returning id,sender_id,receiver_id,content,created_at,read_at`,
      [session.userId, receiverId, content]
    );
    return res.status(201).json({ message: inserted.rows[0] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Friends / Connections ─────────────────────────────────────────────────────
// GET /api/friends – list accepted connections for current user (with profile info)
app.get("/api/friends", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const result = await pool.query(
      `select u.id, u.username, p.full_name, p.avatar_url, p.role, p.company,
              p.membership_tier, p.location,
              c.created_at as connected_at
       from connections c
       join users u on u.id = case
         when c.requester_id = $1 then c.addressee_id
         else c.requester_id
       end
       left join profiles p on p.user_id = u.id
       where (c.requester_id = $1 or c.addressee_id = $1)
         and c.status = 'accepted'
       order by c.created_at desc`,
      [session.userId]
    );
    return res.status(200).json({ friends: result.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// GET /api/friends/requests – incoming pending connection requests
app.get("/api/friends/requests", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const result = await pool.query(
      `select c.requester_id, c.created_at as requested_at,
              u.id, u.username, p.full_name, p.avatar_url, p.role, p.company
       from connections c
       join users u on u.id = c.requester_id
       left join profiles p on p.user_id = u.id
       where c.addressee_id = $1 and c.status = 'pending'
       order by c.created_at desc`,
      [session.userId]
    );
    return res.status(200).json({ requests: result.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// POST /api/friends/:userId – send or cancel a connection request
app.post("/api/friends/:userId", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const targetId = Number(req.params.userId);
    if (!targetId || targetId === session.userId) return res.status(400).json({ error: "Invalid user" });

    // Check if connection already exists in either direction
    const existing = await pool.query(
      `select requester_id, addressee_id, status from connections
       where (requester_id=$1 and addressee_id=$2) or (requester_id=$2 and addressee_id=$1)`,
      [session.userId, targetId]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.requester_id === session.userId) {
        // Cancel own pending request
        await pool.query(`delete from connections where requester_id=$1 and addressee_id=$2`, [session.userId, targetId]);
        return res.status(200).json({ status: "cancelled" });
      }
      return res.status(200).json({ status: row.status, message: "Connection already exists" });
    }

    await pool.query(
      `insert into connections(requester_id, addressee_id, status) values($1,$2,'pending') on conflict do nothing`,
      [session.userId, targetId]
    );
    return res.status(201).json({ status: "pending" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// PUT /api/friends/:userId – accept or reject a pending request
app.put("/api/friends/:userId", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const requesterId = Number(req.params.userId);
    const body = req.body as { action: "accept" | "reject" };
    const action = body.action;
    if (!action || !["accept", "reject"].includes(action)) return res.status(400).json({ error: "action must be accept or reject" });

    if (action === "accept") {
      await pool.query(
        `update connections set status='accepted', updated_at=now() where requester_id=$1 and addressee_id=$2 and status='pending'`,
        [requesterId, session.userId]
      );
      return res.status(200).json({ status: "accepted" });
    } else {
      await pool.query(`delete from connections where requester_id=$1 and addressee_id=$2`, [requesterId, session.userId]);
      return res.status(200).json({ status: "rejected" });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.delete("/api/feed/:id", async (req, res) => {
  try {
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const postId = Number(req.params.id);

    const postRes = await pool.query("select user_id from posts where id=$1", [postId]);
    if (postRes.rows.length === 0) return res.status(404).json({ error: "Not found" });
    if (Number(postRes.rows[0].user_id) !== Number(session.userId)) return res.status(403).json({ error: "Forbidden" });

    await pool.query("delete from comments where post_id=$1", [postId]);
    await pool.query("delete from post_likes where post_id=$1", [postId]);
    await pool.query("delete from post_saves where post_id=$1", [postId]);
    await pool.query("delete from posts where id=$1 and user_id=$2", [postId, session.userId]);

    return res.status(200).json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

// ── Comments ──────────────────────────────────────────────────────────────────
app.get("/api/feed/:id/comments", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const postId = Number(req.params.id);
    if (!postId) return res.status(400).json({ error: "Invalid post id" });
    const result = await pool.query(
      `select c.id, c.content, c.created_at, c.user_id,
              u.username, p.full_name, p.avatar_url
       from comments c
       join users u on u.id = c.user_id
       left join profiles p on p.user_id = u.id
       where c.post_id = $1
       order by c.created_at asc
       limit 100`,
      [postId]
    );
    return res.status(200).json({ comments: result.rows });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.post("/api/feed/:id/comments", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const postId = Number(req.params.id);
    const content = String((req.body as any)?.content || "").trim();
    if (!postId) return res.status(400).json({ error: "Invalid post id" });
    if (!content) return res.status(400).json({ error: "Content required" });
    const inserted = await pool.query(
      `insert into comments(post_id, user_id, content) values($1,$2,$3)
       returning id, content, created_at, user_id`,
      [postId, session.userId, content]
    );
    await pool.query(`update posts set comment_count = comment_count + 1 where id=$1`, [postId]);
    // Fetch author info
    const userRes = await pool.query(
      `select u.username, p.full_name, p.avatar_url from users u left join profiles p on p.user_id=u.id where u.id=$1`,
      [session.userId]
    );
    const comment = { ...inserted.rows[0], ...userRes.rows[0] };
    return res.status(201).json({ comment });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.delete("/api/comments/:id", async (req, res) => {
  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const commentId = Number(req.params.id);
    const cRes = await pool.query(`select post_id, user_id from comments where id=$1`, [commentId]);
    if (!cRes.rows[0]) return res.status(404).json({ error: "Not found" });
    if (Number(cRes.rows[0].user_id) !== Number(session.userId)) return res.status(403).json({ error: "Forbidden" });
    const postId = cRes.rows[0].post_id;
    await pool.query(`delete from comments where id=$1`, [commentId]);
    await pool.query(`update posts set comment_count = greatest(0, comment_count - 1) where id=$1`, [postId]);
    return res.status(200).json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get("/api/online", async (req, res) => {
  try {
    await ensureSchema();
    getSessionFromAuthHeader(req.header("authorization"));
    const pool = getPool();
    const result = await pool.query(`
      select u.id, u.username, u.last_seen, p.full_name, p.avatar_url, p.role
      from users u
      left join profiles p on p.user_id = u.id
      where u.last_seen >= (now() - interval '15 minutes')
      order by u.last_seen desc
      limit 50
    `);
    const users = result.rows.map((r) => ({
      id: r.id,
      username: r.username,
      fullName: r.full_name,
      avatarUrl: r.avatar_url,
      role: r.role,
      lastSeen: r.last_seen,
    }));
    return res.status(200).json({ users });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) return res.status(401).json({ error: "Unauthorized" });
    return res.status(500).json({ error: "Server error", details: message });
  }
});

app.get(/.*/, (_req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

const port = Number(process.env.PORT || process.env.API_PORT || 8787);
app.listen(port, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://0.0.0.0:${port}`);
});
