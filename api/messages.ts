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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    allowMethods(res, ["GET", "POST"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.headers.authorization);
    const pool = getPool();

    const url = getUrl(req);
    const targetUserId = url.searchParams.get("u");

    // GET: Fetch message history OR list conversations
    if (req.method === "GET") {
      if (targetUserId) {
        // Fetch history with specific user
        const history = await pool.query(
          `select m.*, 
            u.username as sender_username, 
            p.full_name as sender_name,
            p.avatar_url as sender_avatar
           from messages m
           join users u on u.id = m.sender_id
           left join profiles p on p.user_id = u.id
           where (m.sender_id = $1 and m.receiver_id = $2)
              or (m.sender_id = $2 and m.receiver_id = $1)
           order by m.created_at asc
           limit 100`,
          [session.userId, targetUserId]
        );

        // Mark as read
        await pool.query(
          `update messages set read_at = now()
           where receiver_id = $1 and sender_id = $2 and read_at is null`,
          [session.userId, targetUserId]
        );

        return sendJson(res, 200, { messages: history.rows });
      } else {
        // List conversations (last message from each interactant)
        const conversations = await pool.query(
          `with latest_msgs as (
            select distinct on (interactant_id)
              id,
              case when sender_id = $1 then receiver_id else sender_id end as interactant_id,
              content,
              created_at,
              read_at,
              sender_id
            from messages
            where sender_id = $1 or receiver_id = $1
            order by interactant_id, created_at desc
          )
          select l.*, 
            u.username, p.full_name, p.avatar_url, p.role, p.company
          from latest_msgs l
          join users u on u.id = l.interactant_id
          left join profiles p on p.user_id = u.id
          order by l.created_at desc`,
          [session.userId]
        );

        return sendJson(res, 200, { conversations: conversations.rows });
      }
    }

    // POST: Send a message
    if (req.method === "POST") {
      const { receiverId, content } = await readJson<{ receiverId: string | number; content: string }>(req);
      if (!receiverId || !content.trim()) {
        return sendJson(res, 400, { error: "Invalid receiver or content" });
      }

      const inserted = await pool.query(
        `insert into messages (sender_id, receiver_id, content)
         values ($1, $2, $3)
         returning *`,
        [session.userId, receiverId, content.trim()]
      );

      return sendJson(res, 201, { message: inserted.rows[0] });
    }

  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}
