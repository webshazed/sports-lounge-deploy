import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AUTH_CHANGED_EVENT, isAuthed } from "@/lib/auth";

export const MESSAGES_UPDATED_EVENT = "messages-updated";

type UnreadResponse = {
  unreadCount: number;
};

export function useUnreadMessagesCount({ enabled = true, pollMs = 5000 }: { enabled?: boolean; pollMs?: number } = {}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!enabled || !isAuthed()) {
        if (!cancelled) setCount(0);
        return;
      }

      try {
        const data = await apiFetch<UnreadResponse>("/api/messages-unread-count");
        if (!cancelled) setCount(data.unreadCount || 0);
      } catch {
        if (!cancelled) setCount(0);
      }
    };

    load();
    const interval = window.setInterval(load, pollMs);
    window.addEventListener(AUTH_CHANGED_EVENT, load);
    window.addEventListener("storage", load);
    window.addEventListener(MESSAGES_UPDATED_EVENT, load);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener(AUTH_CHANGED_EVENT, load);
      window.removeEventListener("storage", load);
      window.removeEventListener(MESSAGES_UPDATED_EVENT, load);
    };
  }, [enabled, pollMs]);

  return count;
}
