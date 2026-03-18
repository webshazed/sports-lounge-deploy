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
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
  const parsed = await readJsonOrText<T | { error?: string; details?: string }>(res);

  if (!parsed.ok) {
    const errorText = (parsed as { text: string }).text || "Unknown error";
    const err = new Error(`Request failed (${res.status}). ${errorText.slice(0, 200)}`) as ApiError;
    err.status = res.status;
    throw err;
  }

  const data = parsed.json;
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data && typeof (data as any).error === "string"
        ? String((data as any).error)
        : `Request failed (${res.status})`;
    const err = new Error(msg) as ApiError;
    err.status = res.status;
    throw err;
  }

  return data as T;
}

