export const AUTH_CHANGED_EVENT = "auth-changed";

export type AuthUser = { 
  id?: number | string; 
  email?: string; 
  username?: string;
  fullName?: string;
  avatarUrl?: string | null;
};

export function isAuthed() {
  try {
    return Boolean(localStorage.getItem("auth_token"));
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
export function logout() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
  notifyAuthChanged();
}

