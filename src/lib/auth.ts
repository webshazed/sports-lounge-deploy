export const AUTH_CHANGED_EVENT = "auth-changed";
export const SESSION_WARNING_EVENT = "session-warning";

/** Idle timeout in ms — 30 minutes */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
/** How long before idle-logout we show a warning — 2 minutes */
export const IDLE_WARNING_BEFORE_MS = 2 * 60 * 1000;
/** How often to check token expiry — 60 seconds */
export const EXPIRY_CHECK_INTERVAL_MS = 60 * 1000;
/** Show expiry warning when token has less than this left — 5 minutes */
export const TOKEN_WARNING_THRESHOLD_MS = 5 * 60 * 1000;

export type AuthUser = { 
  id?: number | string; 
  email?: string; 
  username?: string;
  fullName?: string;
  avatarUrl?: string | null;
};

/* ------------------------------------------------------------------ */
/*  JWT helpers (client-side, no library needed)                       */
/* ------------------------------------------------------------------ */

/** Decode a JWT payload without verification (client-side only) */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Returns the token's expiry timestamp in ms, or null if unreadable */
export function getTokenExpiryMs(): number | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return payload.exp * 1000; // JWT exp is in seconds
}

/** Returns ms remaining until the token expires, or 0 if expired/missing */
export function getTokenRemainingMs(): number {
  const exp = getTokenExpiryMs();
  if (!exp) return 0;
  return Math.max(0, exp - Date.now());
}

/** True if the stored token is expired or missing */
export function isTokenExpired(): boolean {
  const token = getToken();
  if (!token) return true;
  const remaining = getTokenRemainingMs();
  return remaining <= 0;
}

/** True if the token will expire within `thresholdMs` */
export function isTokenExpiringSoon(thresholdMs = TOKEN_WARNING_THRESHOLD_MS): boolean {
  const remaining = getTokenRemainingMs();
  return remaining > 0 && remaining <= thresholdMs;
}

/* ------------------------------------------------------------------ */
/*  Core auth state                                                    */
/* ------------------------------------------------------------------ */

function getToken(): string {
  try {
    return localStorage.getItem("auth_token") || "";
  } catch {
    return "";
  }
}

export function isAuthed(): boolean {
  try {
    const token = localStorage.getItem("auth_token");
    if (!token) return false;
    // Proactively check expiry
    if (isTokenExpired()) {
      // Token is expired — clean up silently
      logout(true);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function notifySessionWarning(remainingMs: number) {
  window.dispatchEvent(
    new CustomEvent(SESSION_WARNING_EVENT, { detail: { remainingMs } })
  );
}

export function updateAuthUser(updates: Partial<AuthUser>) {
  try {
    const current = getAuthUser();
    if (current) {
      const updated = { ...current, ...updates };
      localStorage.setItem("auth_user", JSON.stringify(updated));
      notifyAuthChanged();
    }
  } catch (e) {
    // silent
  }
}

/**
 * Log the user out — clear token & user data.
 * @param silent  If true, skip the auth-changed event (used internally to avoid loops)
 */
export function logout(silent = false) {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  localStorage.removeItem("last_activity");
  if (!silent) notifyAuthChanged();
}

/* ------------------------------------------------------------------ */
/*  Activity tracking for idle timeout                                 */
/* ------------------------------------------------------------------ */

export function recordActivity() {
  try {
    localStorage.setItem("last_activity", String(Date.now()));
  } catch {
    // silent
  }
}

export function getLastActivity(): number {
  try {
    const raw = localStorage.getItem("last_activity");
    return raw ? Number(raw) : Date.now();
  } catch {
    return Date.now();
  }
}

export function getIdleMs(): number {
  return Date.now() - getLastActivity();
}

/** Attempt to refresh the token via the server */
export async function refreshToken(): Promise<boolean> {
  try {
    const token = localStorage.getItem("auth_token");
    if (!token) return false;

    const res = await fetch("/api/refresh", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return false;

    const data = await res.json();
    if (data.token) {
      localStorage.setItem("auth_token", data.token);
      if (data.user) {
        const current = getAuthUser();
        const merged = { ...current, ...data.user };
        localStorage.setItem("auth_user", JSON.stringify(merged));
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
