import type { IncomingMessage, ServerResponse } from "node:http";
import { signInUser } from "./_lib/auth.js";
import { getPool } from "./_lib/db.js";
import { allowMethods, readJson, sendJson } from "./_lib/http.js";

type SignInBody = {
  emailOrUsername?: string;
  password?: string;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    allowMethods(res, ["POST"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readJson<SignInBody>(req);
    const emailOrUsername = body.emailOrUsername || "";
    const password = body.password || "";

    const result = await signInUser({ emailOrUsername, password });
    try {
      const pool = getPool();
      await pool.query(`update users set last_seen = now() where id = $1`, [result.user.id]);
    } catch {
      // best-effort; do not block signin on analytics
    }
    return sendJson(res, 200, result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Invalid input") return sendJson(res, 400, { error: "Invalid input" });
    if (message === "Invalid credentials") return sendJson(res, 401, { error: "Invalid credentials" });
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

