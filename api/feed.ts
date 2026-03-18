import type { IncomingMessage, ServerResponse } from "node:http";
import { ensureSchema, getPool } from "./_lib/db.js";
import { getSessionFromAuthHeader } from "./_lib/session.js";
import { allowMethods, readJson, sendJson } from "./_lib/http.js";

function getUrl(req: IncomingMessage) {
  const host = req.headers.host || "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const path = req.url || "/";
  return new URL(path, `${proto}://${host}`);
}

type CreatePostBody = { kind?: "Post" | "Business" | "Events" | "Matches"; content?: string };

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    allowMethods(res, ["GET", "POST"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.headers.authorization);
    const pool = getPool();

    if (req.method === "POST") {
      const body = await readJson<CreatePostBody>(req);
      const kind = (body.kind || "Post").trim() as CreatePostBody["kind"];
      const content = (body.content || "").trim();
      if (!content) return sendJson(res, 400, { error: "Content required" });
      if (!["Post", "Business", "Events", "Matches"].includes(kind || "")) {
        return sendJson(res, 400, { error: "Invalid kind" });
      }

      const inserted = await pool.query(
        `insert into posts (user_id, kind, content) values ($1,$2,$3)
         returning id, kind, content, like_count, comment_count, created_at`,
        [session.userId, kind, content]
      );
      return sendJson(res, 201, { post: inserted.rows[0] });
    }

    const url = getUrl(req);
    const filter = (url.searchParams.get("filter") || "All").trim();
    const limitRaw = Number(url.searchParams.get("limit") || "30");
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
      [session.userId, ...params]
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

    return sendJson(res, 200, { posts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

