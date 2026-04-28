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
const DEFAULT_SQL_PATH = path.join(
  process.cwd(),
  "Old databse wordpress",
  "SCWORDPRESS-353038315495.sql"
);
const WORDPRESS_SITE_ORIGIN = "https://sportslounge.club";

type LegacyUser = {
  ID: string;
  user_login: string;
  user_nicename?: string;
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

type ProfileMediaDraft = {
  avatarUrl: string | null;
  coverImageUrl: string | null;
};

type LegacyActivity = {
  id: number;
  userId: string;
  component: string;
  type: string;
  action: string;
  content: string;
  dateRecorded: string;
};

type LegacyMedia = {
  mediaUrl: string | null;
  mediaType: string | null;
  mediaUrls: string[];
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

  const withLinks = value.replace(
    /<a\b[^>]*href=(["'])(.*?)\1[^>]*>(.*?)<\/a>/gis,
    (_match, _quote, href: string, text: string) => {
      const plainText = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!plainText) return href;
      return plainText.includes(href) ? plainText : `${plainText} (${href})`;
    }
  );

  const withBreaks = withLinks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n");

  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(withoutTags)
    .replace(/\\'/g, "'")
    .replace(/\\\"/g, '"')
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^-+\s*/g, "")
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

function normalizeMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${WORDPRESS_SITE_ORIGIN}${trimmed}`;
  return trimmed;
}

function findSqlStatementEnd(rawSql: string, startIndex: number) {
  let inString = false;

  for (let i = startIndex; i < rawSql.length; i += 1) {
    const ch = rawSql[i];
    const next = rawSql[i + 1];

    if (inString) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === "'" && next === "'") {
        i += 1;
        continue;
      }
      if (ch === "'") {
        inString = false;
      }
      continue;
    }

    if (ch === "'") {
      inString = true;
      continue;
    }

    if (ch === ";") return i;
  }

  return -1;
}

function extractSqlInsertValuesBlocks(rawSql: string, tableName: string) {
  const marker = `INSERT INTO \`${tableName}\``;
  const blocks: string[] = [];
  let searchIndex = 0;

  while (true) {
    const start = rawSql.indexOf(marker, searchIndex);
    if (start === -1) break;

    const valuesStart = rawSql.indexOf("VALUES\n", start);
    if (valuesStart === -1) {
      throw new Error(`INSERT for ${tableName} is missing VALUES`);
    }

    const statementEnd = findSqlStatementEnd(rawSql, valuesStart + 7);
    if (statementEnd === -1) {
      throw new Error(`INSERT for ${tableName} is missing statement terminator`);
    }

    blocks.push(rawSql.slice(valuesStart + 7, statementEnd));
    searchIndex = statementEnd + 1;
  }

  if (blocks.length === 0) {
    throw new Error(`Table ${tableName} not found in SQL export`);
  }

  return blocks;
}

function parseSqlValueRows(valuesBlock: string) {
  const rows: (string | number | null)[][] = [];
  let index = 0;

  const skipWhitespaceAndCommas = () => {
    while (index < valuesBlock.length) {
      const ch = valuesBlock[index];
      if (ch === "," || ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
        index += 1;
        continue;
      }
      break;
    }
  };

  const parseSqlString = () => {
    let output = "";
    index += 1;

    while (index < valuesBlock.length) {
      const ch = valuesBlock[index];
      const next = valuesBlock[index + 1];

      if (ch === "\\") {
        if (next === "n") output += "\n";
        else if (next === "r") output += "\r";
        else if (next === "t") output += "\t";
        else if (next === "0") output += "\0";
        else if (next === "Z") output += "\u001a";
        else if (next !== undefined) output += next;
        index += 2;
        continue;
      }

      if (ch === "'" && next === "'") {
        output += "'";
        index += 2;
        continue;
      }

      if (ch === "'") {
        index += 1;
        break;
      }

      output += ch;
      index += 1;
    }

    return output;
  };

  const parseScalar = () => {
    skipWhitespaceAndCommas();

    if (valuesBlock.startsWith("NULL", index)) {
      index += 4;
      return null;
    }

    if (valuesBlock[index] === "'") {
      return parseSqlString();
    }

    const start = index;
    while (index < valuesBlock.length && valuesBlock[index] !== "," && valuesBlock[index] !== ")") {
      index += 1;
    }

    const raw = valuesBlock.slice(start, index).trim();
    if (!raw) return "";
    if (/^-?\d+$/.test(raw)) return Number(raw);
    return raw;
  };

  while (index < valuesBlock.length) {
    skipWhitespaceAndCommas();
    if (valuesBlock[index] !== "(") {
      index += 1;
      continue;
    }

    index += 1;
    const row: (string | number | null)[] = [];

    while (index < valuesBlock.length) {
      row.push(parseScalar());
      skipWhitespaceAndCommas();

      if (valuesBlock[index] === ",") {
        index += 1;
        continue;
      }

      if (valuesBlock[index] === ")") {
        index += 1;
        break;
      }
    }

    rows.push(row);
  }

  return rows;
}

function loadLegacyActivities(rawSql: string) {
  const rows = extractSqlInsertValuesBlocks(rawSql, "88_bp_activity").flatMap(parseSqlValueRows);

  return rows.map((row) => ({
    id: Number(row[0]),
    userId: String(row[1]),
    component: String(row[2] || ""),
    type: String(row[3] || ""),
    action: String(row[4] || ""),
    content: String(row[5] || ""),
    dateRecorded: String(row[9] || ""),
  })) as LegacyActivity[];
}

function extractMediaFromHtml(value: string | null | undefined): LegacyMedia {
  const urls: string[] = [];
  const mediaTypes = new Set<string>();

  if (value) {
    const regex = /<(img|video|audio)\b[^>]*\bsrc=(["'])(.*?)\2/gi;
    for (const match of value.matchAll(regex)) {
      const tag = match[1]?.toLowerCase();
      const mediaUrl = normalizeMediaUrl(match[3]);
      if (!mediaUrl || urls.includes(mediaUrl)) continue;

      urls.push(mediaUrl);
      if (tag === "img") mediaTypes.add("image");
      if (tag === "video") mediaTypes.add("video");
      if (tag === "audio") mediaTypes.add("audio");
    }
  }

  const mediaType =
    mediaTypes.size === 0 ? null : mediaTypes.size === 1 ? [...mediaTypes][0] || null : "mixed";

  return {
    mediaUrl: urls[0] || null,
    mediaType,
    mediaUrls: urls,
  };
}

function buildLegacyPostDraft(activity: LegacyActivity) {
  const media = extractMediaFromHtml(activity.content);
  const strippedContent = stripHtml(activity.content);
  const fallbackAction = stripHtml(activity.action);
  const content = strippedContent || fallbackAction || (media.mediaUrls.length ? "Shared media" : "");
  if (!content) return null;

  const isGroupPost = activity.component === "groups";
  const isMediaPost = activity.type === "rtmedia_update";

  return {
    legacyPostId: activity.id,
    legacyUserId: activity.userId,
    kind: isGroupPost ? "Group Post" : isMediaPost ? "Media" : "Post",
    content,
    mediaUrl: media.mediaUrl,
    mediaType: media.mediaType,
    mediaUrls: media.mediaUrls,
    createdAt: normalizeDate(activity.dateRecorded) || new Date().toISOString(),
  };
}

async function fetchTextWithTimeout(url: string, timeoutMs = 5_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "sports-lounge-buddyboss-import/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchProfileMedia(
  slugCandidates: Array<string | null | undefined>
): Promise<ProfileMediaDraft> {
  const tried = new Set<string>();
  const failures: string[] = [];

  for (const candidate of slugCandidates) {
    const slug = candidate?.trim();
    if (!slug || tried.has(slug)) continue;
    tried.add(slug);

    const profileUrl = `${WORDPRESS_SITE_ORIGIN}/members/${encodeURIComponent(slug)}/`;

    try {
      const html = await fetchTextWithTimeout(profileUrl);
      const avatarMatch = html.match(
        /https:\/\/sportslounge\.club\/wp-content\/uploads\/avatars\/\d+\/[^"'\\\s>]+-bpfull\.(?:png|jpe?g|gif|webp)/i
      );
      const coverMatch = html.match(
        /https:\/\/sportslounge\.club\/wp-content\/uploads\/buddypress\/members\/\d+\/cover-image\/[^"'\\\s>]+/i
      );

      const avatarUrl = normalizeMediaUrl(avatarMatch?.[0] || null);
      const rawCoverImageUrl = normalizeMediaUrl(coverMatch?.[0] || null);
      const coverImageUrl =
        rawCoverImageUrl && !rawCoverImageUrl.includes("/members/0/cover-image/cover-image.")
          ? rawCoverImageUrl
          : null;

      if (avatarUrl || coverImageUrl) {
        return { avatarUrl, coverImageUrl };
      }
    } catch (error) {
      failures.push(`${slug}: ${String(error)}`);
    }
  }

  if (failures.length > 0) {
    console.warn(`Unable to fetch legacy profile media for ${failures.join("; ")}`);
  }

  return { avatarUrl: null, coverImageUrl: null };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await worker(items[current]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

function preferImportedMedia(existing: string | null | undefined, incoming: string | null | undefined) {
  return isNonEmpty(existing) ? existing!.trim() : incoming;
}

async function main() {
  const jsonPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_JSON_PATH;
  const sqlPath = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_SQL_PATH;
  const rawJson = fs.readFileSync(jsonPath, "utf8");
  const rawSql = fs.readFileSync(sqlPath, "utf8");

  console.log(`Reading BuddyBoss JSON export from ${jsonPath}`);
  console.log(`Reading BuddyBoss SQL export from ${sqlPath}`);

  const users = extractTableFromJsonDump<LegacyUser>(rawJson, "88_users");
  const userMeta = extractTableFromJsonDump<LegacyUserMeta>(rawJson, "88_usermeta");
  const xprofileFields = extractTableFromJsonDump<LegacyXProfileField>(rawJson, "88_bp_xprofile_fields");
  const xprofileData = extractTableFromJsonDump<LegacyXProfileData>(rawJson, "88_bp_xprofile_data");
  const messages = extractTableFromJsonDump<LegacyMessage>(rawJson, "88_bp_messages_messages");
  const recipients = extractTableFromJsonDump<LegacyRecipient>(rawJson, "88_bp_messages_recipients");
  const activities = loadLegacyActivities(rawSql)
    .filter(
      (activity) =>
        activity.type === "activity_update" || activity.type === "rtmedia_update"
    )
    .map(buildLegacyPostDraft)
    .filter(Boolean);

  await ensureSchema();
  const pool = getPool();

  const metaByUser = buildMetaMap(userMeta);
  const xprofileByUser = buildXProfileMap(xprofileFields, xprofileData);
  const fetchedProfileMedia = await mapWithConcurrency(users, 4, async (legacyUser) => ({
    legacyUserId: String(legacyUser.ID),
    media: await fetchProfileMedia([legacyUser.user_login, legacyUser.user_nicename]),
  }));
  const profileMediaByUser = new Map(
    fetchedProfileMedia.map((entry) => [entry.legacyUserId, entry.media])
  );

  const importedUsers = new Map<string, number>();
  let createdUsers = 0;
  let mappedUsers = 0;
  let upsertedProfiles = 0;
  let enrichedProfilesWithMedia = 0;
  let createdSubscriptions = 0;
  let importedPosts = 0;
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
      const profileMediaDraft = profileMediaByUser.get(legacyUserId) || {
        avatarUrl: null,
        coverImageUrl: null,
      };

      await pool.query(
        `insert into profiles
          (user_id, full_name, bio, membership_tier, location, phone, dob, gender, about_you, address_line1, city, country, avatar_url, cover_image_url, updated_at)
         values ($1, $2, $3, 'Gold', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
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
           avatar_url = excluded.avatar_url,
           cover_image_url = excluded.cover_image_url,
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
          preferImportedMedia(existingProfile.avatar_url, profileMediaDraft.avatarUrl),
          preferImportedMedia(existingProfile.cover_image_url, profileMediaDraft.coverImageUrl),
        ]
      );
      upsertedProfiles += 1;
      if (profileMediaDraft.avatarUrl || profileMediaDraft.coverImageUrl) {
        enrichedProfilesWithMedia += 1;
      }

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

    for (const activityPost of activities) {
      if (!activityPost) continue;

      const userId = importedUsers.get(activityPost.legacyUserId);
      if (!userId) continue;

      const existingLegacyPost = await pool.query(
        `select new_post_id
         from legacy_post_mappings
         where source = $1 and legacy_post_id = $2
         limit 1`,
        [SOURCE, activityPost.legacyPostId]
      );
      const mappedPostId = existingLegacyPost.rows[0]?.new_post_id as number | undefined;

      if (mappedPostId) {
        await pool.query(
          `update posts
           set user_id = $2,
               kind = $3,
               content = $4,
               media_url = $5,
               media_type = $6,
               media_urls = $7,
               created_at = $8
           where id = $1`,
          [
            mappedPostId,
            userId,
            activityPost.kind,
            activityPost.content,
            activityPost.mediaUrl,
            activityPost.mediaType,
            activityPost.mediaUrls,
            activityPost.createdAt,
          ]
        );
      } else {
        const insertPost = await pool.query(
          `insert into posts (user_id, kind, content, media_url, media_type, media_urls, created_at)
           values ($1, $2, $3, $4, $5, $6, $7)
           returning id`,
          [
            userId,
            activityPost.kind,
            activityPost.content,
            activityPost.mediaUrl,
            activityPost.mediaType,
            activityPost.mediaUrls,
            activityPost.createdAt,
          ]
        );

        await pool.query(
          `insert into legacy_post_mappings (source, legacy_post_id, new_post_id)
           values ($1, $2, $3)
           on conflict (source, legacy_post_id) do nothing`,
          [SOURCE, activityPost.legacyPostId, insertPost.rows[0].id]
        );

        importedPosts += 1;
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
  console.log(`Profiles enriched with avatar/cover media: ${enrichedProfilesWithMedia}`);
  console.log(`Created subscriptions: ${createdSubscriptions}`);
  console.log(`Imported feed posts: ${importedPosts}`);
  console.log(`Imported direct messages: ${importedMessages}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
