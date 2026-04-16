import type { IncomingMessage, ServerResponse } from "node:http";
import { registerUser } from "./_lib/auth.js";
import { allowMethods, readJson, sendJson } from "./_lib/http.js";

type RegisterBody = {
  email?: string;
  username?: string;
  password?: string;
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    allowMethods(res, ["POST"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const body = await readJson<RegisterBody>(req);
    const email = body.email || "";
    const username = body.username || "";
    const password = body.password || "";
    
    // Pass everything else to registerUser
    const result = await registerUser(body);
    return sendJson(res, 201, result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Invalid input") {
      return sendJson(res, 400, {
        error: "Invalid input",
        details: "email, username required; password must be at least 8 chars",
      });
    }
    if (message.toLowerCase().includes("duplicate key")) {
      return sendJson(res, 409, { error: "Email or username already exists" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}

