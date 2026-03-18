import jwt from "jsonwebtoken";

export type Session = { userId: number; email?: string; username?: string };

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "dev-insecure-secret";
  throw new Error("Missing JWT_SECRET env var");
}

export function getSessionFromAuthHeader(authHeader: string | undefined): Session {
  if (!authHeader) throw new Error("Unauthorized");
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) throw new Error("Unauthorized");

  const decoded = jwt.verify(token, getJwtSecret()) as { sub?: string; email?: string; username?: string };
  const userId = Number(decoded.sub);
  if (!Number.isFinite(userId)) throw new Error("Unauthorized");
  return { userId, email: decoded.email, username: decoded.username };
}

