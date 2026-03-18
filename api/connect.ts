import type { IncomingMessage, ServerResponse } from "node:http";
import { ensureSchema, getPool } from "./_lib/db.js";
import { getSessionFromAuthHeader } from "./_lib/session.js";
import { allowMethods, readJson, sendJson } from "./_lib/http.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!["GET", "POST", "PUT", "DELETE"].includes(req.method || "")) {
    allowMethods(res, ["GET", "POST", "PUT", "DELETE"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.headers.authorization);
    const pool = getPool();

    // GET: List connections or pending requests
    if (req.method === "GET") {
      // 1. Accepted Connections
      const connections = await pool.query(
        `select 
          u.id, u.username, p.full_name, p.avatar_url, p.role, p.company, c.status
         from connections c
         join users u on (u.id = c.requester_id or u.id = c.receiver_id) and u.id != $1
         left join profiles p on p.user_id = u.id
         where (c.requester_id = $1 or c.receiver_id = $1) and c.status = 'accepted'
        `,
        [session.userId]
      );

      // 2. Pending Requests TO the current user
      const pendingIn = await pool.query(
        `select 
          u.id, u.username, p.full_name, p.avatar_url, p.role, p.company
         from connections c
         join users u on u.id = c.requester_id
         left join profiles p on p.user_id = u.id
         where c.receiver_id = $1 and c.status = 'pending'
        `,
        [session.userId]
      );

      // 3. Pending Requests FROM the current user
      const pendingOut = await pool.query(
        `select 
          u.id, u.username, p.full_name, p.avatar_url, p.role, p.company
         from connections c
         join users u on u.id = c.receiver_id
         left join profiles p on p.user_id = u.id
         where c.requester_id = $1 and c.status = 'pending'
        `,
        [session.userId]
      );

      return sendJson(res, 200, {
        connections: connections.rows,
        pendingIncoming: pendingIn.rows,
        pendingOutgoing: pendingOut.rows,
      });
    }

    // POST: Send a connection request
    if (req.method === "POST") {
      const { targetId } = await readJson<{ targetId: string | number }>(req);
      if (!targetId || Number(targetId) === Number(session.userId)) {
        return sendJson(res, 400, { error: "Invalid target user" });
      }

      await pool.query(
        `insert into connections (requester_id, receiver_id, status)
         values ($1, $2, 'pending')
         on conflict (requester_id, receiver_id) do nothing`,
        [session.userId, targetId]
      );

      return sendJson(res, 201, { success: true });
    }

    // PUT: Accept a request
    if (req.method === "PUT") {
      const { requesterId } = await readJson<{ requesterId: string | number }>(req);
      if (!requesterId) return sendJson(res, 400, { error: "Missing requesterId" });

      await pool.query(
        `update connections set status = 'accepted'
         where requester_id = $1 and receiver_id = $2`,
        [requesterId, session.userId]
      );

      return sendJson(res, 200, { success: true });
    }

    // DELETE: Remove connection or reject request
    if (req.method === "DELETE") {
      const { targetId } = await readJson<{ targetId: string | number }>(req);
      if (!targetId) return sendJson(res, 400, { error: "Missing targetId" });

      await pool.query(
        `delete from connections
         where (requester_id = $1 and receiver_id = $2)
            or (requester_id = $2 and receiver_id = $1)`,
        [session.userId, targetId]
      );

      return sendJson(res, 200, { success: true });
    }

  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}
