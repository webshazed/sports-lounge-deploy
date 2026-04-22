import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, createHmac } from "node:crypto";
import { ensureSchema, getPool } from "./db.js";

export type PublicUser = { id: number; email: string; username: string };

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "dev-insecure-secret";
  throw new Error("Missing JWT_SECRET env var");
}

const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function normalizeBcryptHash(hash: string) {
  return hash.startsWith("$2y$") ? `$2b$${hash.slice(4)}` : hash;
}

function encode64(input: Buffer, count: number) {
  let output = "";
  let i = 0;

  do {
    let value = input[i++] ?? 0;
    output += ITOA64[value & 0x3f];

    if (i < count) {
      value |= (input[i] ?? 0) << 8;
    }
    output += ITOA64[(value >> 6) & 0x3f];

    if (i++ >= count) break;

    if (i < count) {
      value |= (input[i] ?? 0) << 16;
    }
    output += ITOA64[(value >> 12) & 0x3f];

    if (i++ >= count) break;

    output += ITOA64[(value >> 18) & 0x3f];
  } while (i < count);

  return output;
}

function checkPortablePhpPass(password: string, storedHash: string) {
  if (!storedHash.startsWith("$P$") && !storedHash.startsWith("$H$")) return false;

  const countLog2 = ITOA64.indexOf(storedHash[3] || "");
  if (countLog2 < 7 || countLog2 > 30) return false;

  const salt = storedHash.slice(4, 12);
  if (salt.length !== 8) return false;

  let hash = createHash("md5").update(salt + password, "utf8").digest();
  const rounds = 1 << countLog2;
  for (let i = 0; i < rounds; i++) {
    hash = createHash("md5").update(Buffer.concat([hash, Buffer.from(password, "utf8")])).digest();
  }

  const encoded = storedHash.slice(0, 12) + encode64(hash, 16);
  return encoded === storedHash;
}

async function verifyWordPressPassword(password: string, hash: string) {
  if (!hash) return false;
  if (hash.startsWith("$wp$")) {
    const prehashed = createHmac("sha384", "wp-sha384").update(password, "utf8").digest("base64");
    return bcrypt.compare(prehashed, normalizeBcryptHash(hash.slice(3)));
  }
  if (hash.startsWith("$P$") || hash.startsWith("$H$")) {
    return checkPortablePhpPass(password, hash);
  }
  return false;
}

async function verifyPassword(password: string, hash: string) {
  if (!hash) return false;
  if (hash.startsWith("$wp$") || hash.startsWith("$P$") || hash.startsWith("$H$")) {
    return verifyWordPressPassword(password, hash);
  }
  return bcrypt.compare(password, normalizeBcryptHash(hash));
}

function isLegacyPasswordHash(hash: string) {
  return hash.startsWith("$wp$") || hash.startsWith("$P$") || hash.startsWith("$H$");
}

type AuthRow = {
  id: number;
  email: string;
  username: string;
  password_hash: string;
};

async function upgradePasswordHashIfNeeded(userId: number, password: string, currentHash: string) {
  if (!isLegacyPasswordHash(currentHash)) return;
  const pool = getPool();
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(`update users set password_hash = $1 where id = $2`, [passwordHash, userId]);
}

async function findUserByLegacyAlias(emailOrUsername: string) {
  const pool = getPool();
  const result = await pool.query(
    `select u.id, u.email, u.username, u.password_hash,
            lm.legacy_password_hash, lm.legacy_username, lm.legacy_email
     from legacy_user_mappings lm
     join users u on u.id = lm.new_user_id
     where lower(coalesce(lm.legacy_email, '')) = $1
        or lower(coalesce(lm.legacy_username, '')) = $1
     order by lm.imported_at desc
     limit 1`,
    [emailOrUsername]
  );

  return result.rows[0] as
    | (AuthRow & {
        legacy_password_hash: string | null;
        legacy_username: string | null;
        legacy_email: string | null;
      })
    | undefined;
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

  const row = userResult.rows[0] as AuthRow | undefined;

  let authedUser: AuthRow | undefined;
  if (row) {
    const ok = await verifyPassword(password, row.password_hash);
    if (ok) {
      authedUser = row;
    } else {
      const legacy = await findUserByLegacyAlias(emailOrUsername);
      if (
        legacy &&
        legacy.id === row.id &&
        legacy.legacy_password_hash &&
        (await verifyWordPressPassword(password, legacy.legacy_password_hash))
      ) {
        authedUser = row;
      }
    }
  } else {
    const legacy = await findUserByLegacyAlias(emailOrUsername);
    if (
      legacy &&
      legacy.legacy_password_hash &&
      (await verifyWordPressPassword(password, legacy.legacy_password_hash))
    ) {
      authedUser = legacy;
    }
  }

  if (!authedUser) throw new Error("Invalid credentials");

  await upgradePasswordHashIfNeeded(authedUser.id, password, authedUser.password_hash);

  const user: PublicUser = {
    id: authedUser.id,
    email: authedUser.email,
    username: authedUser.username,
  };
  const token = jwt.sign({ sub: String(user.id), ...user }, getJwtSecret(), { expiresIn: "7d" });
  return { token, user };
}

