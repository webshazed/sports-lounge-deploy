import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { AUTH_CHANGED_EVENT, isAuthed } from "@/lib/auth";

export const NOTIFICATIONS_UPDATED_EVENT = "notifications-updated";

export type NotificationItem = {
  id: number;
  kind: "post" | "event" | "comment";
  entity_type: "post" | "event" | "comment";
  entity_id: number;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
  actor_username: string | null;
  actor_full_name: string | null;
  actor_avatar_url: string | null;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
};

type UnreadCountResponse = {
  unreadCount: number;
};

export function useNotifications({
  enabled = true,
  pollMs = 10000,
  limit = 20,
}: {
  enabled?: boolean;
  pollMs?: number;
  limit?: number;
} = {}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    if (!enabled || !isAuthed()) {
      setUnreadCount(0);
      return;
    }

    try {
      const data = await apiFetch<UnreadCountResponse>("/api/notifications-unread-count");
      setUnreadCount(data.unreadCount || 0);
    } catch {
      setUnreadCount(0);
    }
  }, [enabled]);

  const loadNotifications = useCallback(async () => {
    if (!enabled || !isAuthed()) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<NotificationsResponse>(`/api/notifications?limit=${limit}`);
      setItems(data.notifications || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, limit]);

  const refresh = useCallback(async () => {
    await Promise.all([loadUnreadCount(), loadNotifications()]);
  }, [loadNotifications, loadUnreadCount]);

  const markRead = useCallback(
    async (ids?: number[]) => {
      if (!enabled || !isAuthed()) return;

      await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids?.length ? { ids } : {}),
      });

      await refresh();
      window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
    },
    [enabled, refresh]
  );

  useEffect(() => {
    void loadUnreadCount();
    const interval = window.setInterval(() => {
      void loadUnreadCount();
    }, pollMs);

    window.addEventListener(AUTH_CHANGED_EVENT, loadUnreadCount);
    window.addEventListener("storage", loadUnreadCount);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, loadUnreadCount);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(AUTH_CHANGED_EVENT, loadUnreadCount);
      window.removeEventListener("storage", loadUnreadCount);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, loadUnreadCount);
    };
  }, [loadUnreadCount, pollMs]);

  return {
    items,
    unreadCount,
    loading,
    loadNotifications,
    loadUnreadCount,
    refresh,
    markRead,
  };
}
