import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { ensureSchema, getPool } from "./api/_lib/db.js";

const SOURCE = "buddyboss-wordpress";
const DEFAULT_JSON_PATH = path.join(
  process.cwd(),
  "Old databse wordpress",
  "SCWORDPRESS-353038315495.json"
);

type LegacyUser = {
  ID: string;
  user_login: string;
  user_pass: string;
  user_email: string;
  user_registered: string;
  display_name: string;
};

type LegacyUserMeta = {
  user_id: string;
  meta_key: string;
  meta_value: string;
};

type LegacyXProfileField = {
  id: string;
  name: string;
};

type LegacyXProfileData = {
  field_id: string;
  user_id: string;
  value: string;
  last_updated?: string;
};

type LegacyMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  message: string;
  date_sent: string;
  is_deleted: string;
};

type LegacyRecipient = {
  user_id: string;
  thread_id: string;
  unread_count: string;
  is_deleted: string;
  is_hidden: string;
};

type ProfileDraft = {
  fullName: string | null;
  bio: string | null;
  location: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
  aboutYou: string | null;
  addressLine1: string | null;
  city: string | null;
  country: string | null;
};

function extractTableFromJsonDump<T>(rawJson: string, tableName: string): T[] {
  const marker = `"name":"${tableName}"`;
  const markerIndex = rawJson.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Table ${tableName} not found in export`);
  }

  const dataIndex = rawJson.indexOf(`"data":`, markerIndex);
  if (dataIndex === -1) {
    throw new Error(`Table ${tableName} does not contain data`);
  }

  const start = rawJson.indexOf("[", dataIndex);
  if (start === -1) {
    throw new Error(`Table ${tableName} data array start not found`);
  }

  let depth = 0;
  let end = -1;
  for (let i = start; i < rawJson.length; i++) {
    const ch = rawJson[i];
    if (ch === "[") depth++;
    if (ch === "]") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`Table ${tableName} data array end not found`);
  }

  return JSON.parse(rawJson.slice(start, end + 1)) as T[];
}

function isNonEmpty(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizeUsername(value: string | null | undefined) {
  return value?.trim() || null;
}

function stripHtml(value: string | null | undefined) {
  if (!value) return "";

  const withBreaks = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n");

  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(withoutTags)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("0000-00-00")) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeDob(value: string | null | undefined) {
  const iso = normalizeDate(value);
  return iso ? iso.slice(0, 10) : null;
}

function preferExisting(existing: string | null | undefined, incoming: string | null | undefined) {
  return isNonEmpty(existing) ? existing!.trim() : incoming;
}

function makeLocation(city: string | null | undefined, country: string | null | undefined) {
  const parts = [city?.trim(), country?.trim()].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

async function findAvailableUsername(baseUsername: string) {
  const pool = getPool();
  let candidate = baseUsername;
  let suffix = 1;

  while (true) {
    const existing = await pool.query(
      `select 1
       from users
       where lower(username) = lower($1)
       limit 1`,
      [candidate]
    );
    if (existing.rowCount === 0) return candidate;
    suffix += 1;
    candidate = `${baseUsername}-legacy-${suffix}`;
  }
}

function buildMetaMap(rows: LegacyUserMeta[]) {
  const map = new Map<string, Map<string, string>>();
  for (const row of rows) {
    const userId = String(row.user_id);
    const userMeta = map.get(userId) || new Map<string, string>();
    userMeta.set(row.meta_key, row.meta_value);
    map.set(userId, userMeta);
  }
  return map;
}

function buildXProfileMap(fields: LegacyXProfileField[], data: LegacyXProfileData[]) {
  const fieldNames = new Map(fields.map((field) => [String(field.id), field.name]));
  const map = new Map<string, Map<string, string>>();

  for (const row of data) {
    const userId = String(row.user_id);
    const fieldName = fieldNames.get(String(row.field_id));
    if (!fieldName) continue;

    const userData = map.get(userId) || new Map<string, string>();
    userData.set(fieldName, row.value);
    map.set(userId, userData);
  }

  return map;
}

function buildProfileDraft(
  user: LegacyUser,
  userMeta: Map<string, string> | undefined,
  xprofile: Map<string, string> | undefined
): ProfileDraft {
  const firstName = xprofile?.get("First Name") || userMeta?.get("first_name") || "";
  const lastName = xprofile?.get("Last Name") || userMeta?.get("last_name") || "";
  const displayName = stripHtml(user.display_name);
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || displayName || null;

  const city = stripHtml(xprofile?.get("City"));
  const country = stripHtml(xprofile?.get("Country"));
  const address = stripHtml(xprofile?.get("Address"));
  const shortInfo = stripHtml(xprofile?.get("Short info"));
  const description = stripHtml(userMeta?.get("description"));

  return {
    fullName,
    bio: shortInfo || description || null,
    location: makeLocation(city || null, country || null),
    phone: stripHtml(xprofile?.get("Phone")) || null,
    dob: normalizeDob(xprofile?.get("Birthdate")),
    gender: stripHtml(xprofile?.get("Gender")) || null,
    aboutYou: stripHtml(xprofile?.get("About You")) || null,
    addressLine1: address || null,
    city: city || null,
    country: country || null,
  };
}

async function main() {
  const dumpPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_JSON_PATH;
  const rawJson = fs.readFileSync(dumpPath, "utf8");

  console.log(`Reading BuddyBoss export from ${dumpPath}`);

  const users = extractTableFromJsonDump<LegacyUser>(rawJson, "88_users");
  const userMeta = extractTableFromJsonDump<LegacyUserMeta>(rawJson, "88_usermeta");
  const xprofileFields = extractTableFromJsonDump<LegacyXProfileField>(rawJson, "88_bp_xprofile_fields");
  const xprofileData = extractTableFromJsonDump<LegacyXProfileData>(rawJson, "88_bp_xprofile_data");
  const messages = extractTableFromJsonDump<LegacyMessage>(rawJson, "88_bp_messages_messages");
  const recipients = extractTableFromJsonDump<LegacyRecipient>(rawJson, "88_bp_messages_recipients");

  await ensureSchema();
  const pool = getPool();

  const metaByUser = buildMetaMap(userMeta);
  const xprofileByUser = buildXProfileMap(xprofileFields, xprofileData);

  const importedUsers = new Map<string, number>();
  let createdUsers = 0;
  let mappedUsers = 0;
  let upsertedProfiles = 0;
  let createdSubscriptions = 0;
  let importedMessages = 0;

  await pool.query("BEGIN");
  try {
    for (const legacyUser of users) {
      const legacyUserId = String(legacyUser.ID);
      const legacyEmail = normalizeEmail(legacyUser.user_email);
      const legacyUsername = normalizeUsername(legacyUser.user_login);
      if (!legacyEmail || !legacyUsername) {
        console.warn(`Skipping legacy user ${legacyUserId}: missing email or username`);
        continue;
      }

      const mappingRes = await pool.query(
        `select new_user_id
         from legacy_user_mappings
         where source = $1 and legacy_user_id = $2
         limit 1`,
        [SOURCE, legacyUserId]
      );

      let newUserId: number | null = mappingRes.rows[0]?.new_user_id ?? null;

      if (!newUserId) {
        const existingRes = await pool.query(
          `select id, username, email
           from users
           where lower(email) = $1 or lower(username) = $2
           order by case when lower(email) = $1 then 0 else 1 end, id asc
           limit 1`,
          [legacyEmail, legacyUsername.toLowerCase()]
        );

        const existingUser = existingRes.rows[0] as
          | { id: number; username: string; email: string }
          | undefined;

        if (existingUser) {
          newUserId = existingUser.id;
        } else {
          const safeUsername = await findAvailableUsername(legacyUsername);
          const insertUser = await pool.query(
            `insert into users (email, username, password_hash, created_at, last_seen)
             values ($1, $2, $3, $4, $4)
             returning id`,
            [legacyEmail, safeUsername, legacyUser.user_pass, normalizeDate(legacyUser.user_registered) || new Date().toISOString()]
          );
          newUserId = insertUser.rows[0].id as number;
          createdUsers += 1;
        }
      }

      await pool.query(
        `insert into legacy_user_mappings
          (source, legacy_user_id, new_user_id, legacy_username, legacy_email, legacy_display_name, legacy_password_hash)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (source, legacy_user_id) do update set
           new_user_id = excluded.new_user_id,
           legacy_username = excluded.legacy_username,
           legacy_email = excluded.legacy_email,
           legacy_display_name = excluded.legacy_display_name,
           legacy_password_hash = excluded.legacy_password_hash,
           imported_at = now()`,
        [
          SOURCE,
          legacyUserId,
          newUserId,
          legacyUsername,
          legacyEmail,
          stripHtml(legacyUser.display_name) || null,
          legacyUser.user_pass,
        ]
      );
      mappedUsers += 1;
      importedUsers.set(legacyUserId, newUserId);

      const existingProfileRes = await pool.query(`select * from profiles where user_id = $1 limit 1`, [newUserId]);
      const existingProfile = existingProfileRes.rows[0] || {};
      const profileDraft = buildProfileDraft(
        legacyUser,
        metaByUser.get(legacyUserId),
        xprofileByUser.get(legacyUserId)
      );

      await pool.query(
        `insert into profiles
          (user_id, full_name, bio, membership_tier, location, phone, dob, gender, about_you, address_line1, city, country, updated_at)
         values ($1, $2, $3, 'Gold', $4, $5, $6, $7, $8, $9, $10, $11, now())
         on conflict (user_id) do update set
           full_name = excluded.full_name,
           bio = excluded.bio,
           membership_tier = excluded.membership_tier,
           location = excluded.location,
           phone = excluded.phone,
           dob = excluded.dob,
           gender = excluded.gender,
           about_you = excluded.about_you,
           address_line1 = excluded.address_line1,
           city = excluded.city,
           country = excluded.country,
           updated_at = now()`,
        [
          newUserId,
          preferExisting(existingProfile.full_name, profileDraft.fullName),
          preferExisting(existingProfile.bio, profileDraft.bio),
          preferExisting(existingProfile.location, profileDraft.location),
          preferExisting(existingProfile.phone, profileDraft.phone),
          preferExisting(existingProfile.dob, profileDraft.dob),
          preferExisting(existingProfile.gender, profileDraft.gender),
          preferExisting(existingProfile.about_you, profileDraft.aboutYou),
          preferExisting(existingProfile.address_line1, profileDraft.addressLine1),
          preferExisting(existingProfile.city, profileDraft.city),
          preferExisting(existingProfile.country, profileDraft.country),
        ]
      );
      upsertedProfiles += 1;

      const subRes = await pool.query(
        `select 1
         from subscriptions
         where user_id = $1
         limit 1`,
        [newUserId]
      );
      if (subRes.rowCount === 0) {
        await pool.query(
          `insert into subscriptions (user_id, plan_type, price_amount, status, current_period_end, created_at, updated_at)
           values ($1, 'individual', 1999, 'active', now() + interval '100 years', $2, now())`,
          [newUserId, normalizeDate(legacyUser.user_registered) || new Date().toISOString()]
        );
        createdSubscriptions += 1;
      }
    }

    const recipientsByThread = new Map<string, LegacyRecipient[]>();
    for (const recipient of recipients) {
      if (recipient.is_deleted === "1" || recipient.is_hidden === "1") continue;
      const list = recipientsByThread.get(recipient.thread_id) || [];
      list.push(recipient);
      recipientsByThread.set(recipient.thread_id, list);
    }

    for (const legacyMessage of messages) {
      if (legacyMessage.is_deleted === "1") continue;

      const alreadyImported = await pool.query(
        `select 1
         from legacy_message_mappings
         where source = $1 and legacy_message_id = $2
         limit 1`,
        [SOURCE, legacyMessage.id]
      );
      if (alreadyImported.rowCount > 0) continue;

      const senderId = importedUsers.get(String(legacyMessage.sender_id));
      if (!senderId) {
        console.warn(`Skipping message ${legacyMessage.id}: sender was not imported`);
        continue;
      }

      const threadRecipients = recipientsByThread.get(legacyMessage.thread_id) || [];
      const participantIds = [...new Set(threadRecipients.map((recipient) => recipient.user_id))];
      const otherLegacyUsers = participantIds.filter((legacyUserId) => legacyUserId !== legacyMessage.sender_id);
      if (otherLegacyUsers.length === 0) continue;

      if (otherLegacyUsers.length > 1) {
        console.warn(
          `Thread ${legacyMessage.thread_id} has ${otherLegacyUsers.length + 1} members; importing first recipient only`
        );
      }

      const receiverLegacyId = otherLegacyUsers[0];
      const receiverId = importedUsers.get(String(receiverLegacyId));
      if (!receiverId) {
        console.warn(`Skipping message ${legacyMessage.id}: receiver was not imported`);
        continue;
      }

      const content = stripHtml(legacyMessage.message);
      if (!content) continue;

      const everyoneRead = threadRecipients.every((recipient) => Number(recipient.unread_count || "0") === 0);
      const createdAt = normalizeDate(legacyMessage.date_sent) || new Date().toISOString();
      const insertMessage = await pool.query(
        `insert into messages (sender_id, receiver_id, content, read_at, created_at)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [senderId, receiverId, content, everyoneRead ? createdAt : null, createdAt]
      );

      await pool.query(
        `insert into legacy_message_mappings (source, legacy_message_id, new_message_id, legacy_thread_id)
         values ($1, $2, $3, $4)
         on conflict (source, legacy_message_id) do nothing`,
        [SOURCE, legacyMessage.id, insertMessage.rows[0].id, legacyMessage.thread_id]
      );

      importedMessages += 1;
    }

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  } finally {
    await pool.end();
  }

  console.log("BuddyBoss import complete");
  console.log(`Mapped users: ${mappedUsers}`);
  console.log(`Created users: ${createdUsers}`);
  console.log(`Upserted profiles: ${upsertedProfiles}`);
  console.log(`Created subscriptions: ${createdSubscriptions}`);
  console.log(`Imported direct messages: ${importedMessages}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
