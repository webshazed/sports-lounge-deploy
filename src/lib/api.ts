import { logout, notifyAuthChanged } from "./auth";

export type ApiError = Error & { status?: number };

function getToken() {
  try {
    return localStorage.getItem("auth_token") || "";
  } catch {
    return "";
  }
}

async function readJsonOrText<T>(res: Response): Promise<{ ok: true; json: T } | { ok: false; text: string }> {
  const text = await res.text();
  try {
    return { ok: true, json: JSON.parse(text) as T };
  } catch {
    return { ok: false, text };
  }
}

/**
 * Handle a 401 response globally — log the user out and redirect to sign-in.
 * Uses a flag to prevent multiple redirects at once.
 */
let isHandling401 = false;

function handle401() {
  if (isHandling401) return;
  isHandling401 = true;

  logout();
  notifyAuthChanged();

  // Show a toast-style message via a custom event the app can pick up
  window.dispatchEvent(
    new CustomEvent("session-expired", {
      detail: { message: "Session expired — please sign in again." },
    })
  );

  // Redirect to sign-in
  if (window.location.pathname !== "/signin" && window.location.pathname !== "/register") {
    window.location.href = "/signin";
  }

  // Reset the flag after a short delay so future 401s can also trigger
  setTimeout(() => {
    isHandling401 = false;
  }, 3000);
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean }
): Promise<T> {
  const auth = init?.auth !== false;
  const headers = new Headers(init?.headers || undefined);
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(path, { ...init, headers });
  const parsed = await readJsonOrText<T | { error?: string; details?: string }>(res);

  if (!parsed.ok) {
    const err = new Error(`Request failed (${res.status}). ${parsed.text.slice(0, 200)}`) as ApiError;
    err.status = res.status;

    // ─── Global 401 interceptor ───
    if (res.status === 401) {
      handle401();
    }

    throw err;
  }

  const data = parsed.json;
  if (!res.ok) {
    const payload = data as { error?: unknown };
    const msg = typeof payload.error === "string" ? String(payload.error) : `Request failed (${res.status})`;
    const err = new Error(msg) as ApiError;
    err.status = res.status;

    // ─── Global 401 interceptor ───
    if (res.status === 401) {
      handle401();
    }

    throw err;
  }

  return data as T;
}
