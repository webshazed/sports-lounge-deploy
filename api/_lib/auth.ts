import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ensureSchema, getPool } from "./db.js";

export type PublicUser = { id: number; email: string; username: string };

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "dev-insecure-secret";
  throw new Error("Missing JWT_SECRET env var");
}

export async function registerUser(input: {
  email: string;
  username: string;
  password: string;
  couponCode?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dob?: string;
  gender?: string;
  aboutYou?: string;
  regType?: string;
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
}): Promise<{ token: string; user: PublicUser; regType: string }> {
  await ensureSchema();

  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  const password = input.password;

  if (!email || !username || password.length < 8) {
    throw new Error("Invalid input");
  }

  if (input.membershipType === "Coupon Code") {
    if (input.couponCode !== "KINGSOFSPORTSLIFETIME") {
      throw new Error("Invalid Coupon Code");
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const pool = getPool();
  const regType = input.regType || "individual";
  
  await pool.query('BEGIN');
  try {
    const userResult = await pool.query(
      `insert into users (email, username, password_hash)
       values ($1, $2, $3)
       returning id, email, username`,
      [email, username, passwordHash]
    );
    const user = userResult.rows[0];

    await pool.query(
      `insert into profiles (user_id, full_name, phone, dob, gender, about_you, favorite_sports, membership_tier, pl_team, world_team, address_line1, address_line2, city, zip_code, country, biz_type, biz_name, reg_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      [
        user.id,
        `${input.firstName || ""} ${input.lastName || ""}`.trim() || null,
        input.phone || null,
        input.dob || null,
        input.gender || null,
        input.aboutYou || null,
        Array.isArray(input.favoriteSports) ? input.favoriteSports.join(", ") : (input.favoriteSports || null),
        input.membershipType || "Gold",
        Array.isArray(input.plTeam) ? input.plTeam.join(", ") : (input.plTeam || null),
        Array.isArray(input.worldTeam) ? input.worldTeam.join(", ") : (input.worldTeam || null),
        input.addressLine1 || null,
        input.addressLine2 || null,
        input.city || null,
        input.zipCode || null,
        input.country || null,
        input.bizType || null,
        input.bizName || null,
        regType
      ]
    );

    // Apply lifetime subscription if coupon is used
    if (input.membershipType === "Coupon Code" && input.couponCode === "KINGSOFSPORTSLIFETIME") {
      await pool.query(
        `insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan_type, price_amount, status, current_period_end, updated_at)
         values ($1, 'coupon', 'coupon_lifetime', 'lifetime', 0, 'active', '2099-12-31', now())`,
        [user.id]
      );
    }

    await pool.query('COMMIT');
    
    // Issue a JWT token so the user is auto-logged-in after registration
    const token = jwt.sign({ sub: String(user.id), ...user }, getJwtSecret(), { expiresIn: "7d" });
    return { token, user: user as PublicUser, regType };
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

export async function signInUser(input: {
  emailOrUsername: string;
  password: string;
}): Promise<{ token: string; user: PublicUser }> {
  await ensureSchema();

  const emailOrUsername = input.emailOrUsername.trim().toLowerCase();
  const password = input.password;
  if (!emailOrUsername || !password) throw new Error("Invalid input");

  const pool = getPool();
  const userResult = await pool.query(
    `select id, email, username, password_hash
     from users
     where lower(email) = $1 or lower(username) = $1
     limit 1`,
    [emailOrUsername]
  );

  const row = userResult.rows[0] as
    | { id: number; email: string; username: string; password_hash: string }
    | undefined;
  if (!row) throw new Error("Invalid credentials");

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) throw new Error("Invalid credentials");

  const user: PublicUser = { id: row.id, email: row.email, username: row.username };
  const token = jwt.sign({ sub: String(user.id), ...user }, getJwtSecret(), { expiresIn: "7d" });
  return { token, user };
}

