import type { Pool, PoolClient } from "pg";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

type NotificationKind = "post" | "event" | "comment";
type EntityType = "post" | "event" | "comment";

type NotificationInsert = {
  recipientUserId: number;
  actorUserId: number | null;
  kind: NotificationKind;
  entityType: EntityType;
  entityId: number;
  title: string;
  body?: string | null;
  link?: string | null;
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeText(value: string, maxLength = 140) {
  const normalized = collapseWhitespace(value);
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

async function getActorSnapshot(db: Queryable, userId: number) {
  const result = await db.query(
    `select
        u.username,
        coalesce(nullif(p.full_name, ''), u.username) as display_name
     from users u
     left join profiles p on p.user_id = u.id
     where u.id = $1
     limit 1`,
    [userId]
  );

  const row = result.rows[0];
  const username = String(row?.username || "member");
  const displayName = String(row?.display_name || username || "A member");

  return { username, displayName };
}

export async function createNotification(db: Queryable, input: NotificationInsert) {
  if (!input.recipientUserId) return;
  if (input.actorUserId && input.recipientUserId === input.actorUserId) return;

  await db.query(
    `insert into notifications (
       user_id,
       actor_user_id,
       kind,
       entity_type,
       entity_id,
       title,
       body,
       link
     )
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      input.recipientUserId,
      input.actorUserId,
      input.kind,
      input.entityType,
      input.entityId,
      input.title,
      input.body || null,
      input.link || null,
    ]
  );
}

export async function createBroadcastNotification(
  db: Queryable,
  input: Omit<NotificationInsert, "recipientUserId">
) {
  if (!input.actorUserId) return;

  await db.query(
    `insert into notifications (
       user_id,
       actor_user_id,
       kind,
       entity_type,
       entity_id,
       title,
       body,
       link
     )
     select distinct
       s.user_id,
       $1,
       $2,
       $3,
       $4,
       $5,
       $6,
       $7
     from subscriptions s
     where s.user_id <> $1
       and s.status in ('active', 'trialing')`,
    [
      input.actorUserId,
      input.kind,
      input.entityType,
      input.entityId,
      input.title,
      input.body || null,
      input.link || null,
    ]
  );
}

export async function createNewPostNotifications(
  db: Queryable,
  input: {
    actorUserId: number;
    postId: number;
    kind: string;
    content: string;
    hasMedia?: boolean;
  }
) {
  const actor = await getActorSnapshot(db, input.actorUserId);
  const title =
    input.kind === "Business"
      ? `${actor.displayName} shared a business update`
      : input.kind === "Matches"
        ? `${actor.displayName} shared a match update`
        : `${actor.displayName} shared a new post`;

  const body = summarizeText(input.content) || (input.hasMedia ? "New photo or video shared in the network." : "Tap to open the latest post.");

  await createBroadcastNotification(db, {
    actorUserId: input.actorUserId,
    kind: "post",
    entityType: "post",
    entityId: input.postId,
    title,
    body,
    link: "/dashboard",
  });
}

export async function createNewEventNotifications(
  db: Queryable,
  input: {
    actorUserId: number;
    eventId: number;
    title: string;
    startsAt: string;
    location?: string | null;
  }
) {
  const actor = await getActorSnapshot(db, input.actorUserId);
  const startsAtLabel = new Date(input.startsAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const bodyParts = [input.title, startsAtLabel, input.location || ""].filter(Boolean);

  await createBroadcastNotification(db, {
    actorUserId: input.actorUserId,
    kind: "event",
    entityType: "event",
    entityId: input.eventId,
    title: `${actor.displayName} created a new event`,
    body: bodyParts.join(" • "),
    link: "/events",
  });
}

export async function createCommentNotification(
  db: Queryable,
  input: {
    actorUserId: number;
    commentId: number;
    postId: number;
    postOwnerId: number;
    content: string;
  }
) {
  if (!input.postOwnerId || input.postOwnerId === input.actorUserId) return;

  const actor = await getActorSnapshot(db, input.actorUserId);

  await createNotification(db, {
    recipientUserId: input.postOwnerId,
    actorUserId: input.actorUserId,
    kind: "comment",
    entityType: "comment",
    entityId: input.commentId,
    title: `${actor.displayName} commented on your post`,
    body: summarizeText(input.content) || "Tap to view the new comment.",
    link: "/dashboard",
  });
}
