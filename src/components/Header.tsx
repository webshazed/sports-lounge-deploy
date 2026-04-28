import { useEffect, useState } from "react";
import { Menu, X, MessageSquare, ChevronDown, Bell } from "lucide-react";
import { AUTH_CHANGED_EVENT, isAuthed, logout as doLogout, getAuthUser } from "@/lib/auth";
import Avatar from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessagesCount";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNotifications } from "@/hooks/useNotifications";

function notificationTimeLabel(value: string) {
  const created = new Date(value).getTime();
  const diffMs = Date.now() - created;
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type NavChild = {
  label: string;
  href: string;
};

type NavItem = {
  label: string;
  href: string;
  children?: NavChild[];
};

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<{ username: string; fullName?: string; avatarUrl?: string | null } | null>(null);
  const unreadMessages = useUnreadMessagesCount({ enabled: authed });
  const {
    items: notifications,
    unreadCount: unreadNotifications,
    loading: notificationsLoading,
    loadNotifications,
    markRead,
  } = useNotifications({ enabled: authed, pollMs: 8000, limit: 20 });

  const navLinks: NavItem[] = [
    { label: "Home", href: "/" },
    { label: "About", href: "/#about", children: [{ label: "Team", href: "/team" }] },
    { label: "Membership", href: "/membership" },
    { label: "Events", href: "/events" },
    { label: "Interviews", href: "/interviews" },
    { label: "Partners", href: "/partners" },
    { label: "Contact", href: "/contact" },
  ];

  useEffect(() => {
    const sync = async () => {
      const isA = isAuthed();
      setAuthed(isA);
      const u = getAuthUser();
      if (u) {
        setUser({
          username: u.username || "",
          fullName: u.fullName,
          avatarUrl: u.avatarUrl,
        });

        if (!u.avatarUrl && !u.fullName) {
          try {
            const data = await apiFetch<{ user: unknown; profile: { fullName?: string; avatarUrl?: string | null } }>("/api/me");
            const updated = {
              ...u,
              fullName: data.profile?.fullName,
              avatarUrl: data.profile?.avatarUrl,
            };
            localStorage.setItem("auth_user", JSON.stringify(updated));
            setUser({
              username: updated.username || "",
              fullName: updated.fullName,
              avatarUrl: updated.avatarUrl,
            });
          } catch {
            // silent
          }
        }
      } else {
        setUser(null);
      }
    };
    sync();

    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const logout = () => {
    doLogout();
    setMobileOpen(false);
    setNotificationsOpen(false);
  };

  useEffect(() => {
    if (!notificationsOpen || !authed) return;

    const syncNotifications = async () => {
      await loadNotifications();
      if (unreadNotifications > 0) {
        await markRead();
      }
    };

    void syncNotifications();
  }, [authed, loadNotifications, markRead, notificationsOpen, unreadNotifications]);

  return (
    <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
      <header className="bg-white border-b border-border shadow-sm">
        <div className="container mx-auto px-6 flex items-center justify-between h-16">
          <a href="/" className="flex items-center">
            <img src="/Logo-1.png" alt="Sports Lounge" className="h-10 w-auto" />
          </a>

          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) =>
              link.children?.length ? (
                <div key={link.label} className="relative group">
                  <a
                    href={link.href}
                    className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                  >
                    {link.label}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </a>
                  <div className="pointer-events-none absolute left-0 top-full z-30 pt-3 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                    <div className="min-w-[180px] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/70">
                      {link.children.map((child) => (
                        <a
                          key={child.label}
                          href={child.href}
                          className="block rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                        >
                          {child.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  {link.label}
                </a>
              )
            )}
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            {!authed && (
              <>
                <a
                  href="/signin"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </a>
                <a href="/register" className="btn-primary text-xs py-2 px-5">
                  Become a Member
                </a>
              </>
            )}
            {authed && (
              <>
                <a
                  href="/dashboard"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Dashboard
                </a>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(true)}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Open notifications"
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifications > 0 && (
                    <span className="absolute right-1.5 top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </button>
                <a
                  href="/messages"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-2"
                >
                  <span className="relative inline-flex">
                    <MessageSquare className="h-4 w-4" />
                    {unreadMessages > 0 && (
                      <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                        {unreadMessages > 99 ? "99+" : unreadMessages}
                      </span>
                    )}
                  </span>
                  Messages
                </a>
                <a
                  href={user?.username ? `/profile/${user.username}` : "/profile"}
                  className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 transition-all border border-transparent hover:border-border group"
                >
                  <Avatar
                    seed={user?.username || "Guest"}
                    src={user?.avatarUrl}
                    name={user?.fullName || user?.username}
                    className="h-8 w-8 ring-2 ring-transparent group-hover:ring-primary/20 transition-all"
                  />
                  <div className="hidden xl:flex flex-col items-start -space-y-0.5">
                    <span className="text-xs font-bold text-slate-900 leading-none">{user?.fullName || user?.username}</span>
                    <span className="text-[10px] text-muted-foreground">View Profile</span>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </a>
                <button
                  onClick={logout}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
                >
                  Logout
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {authed && (
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-900"
                aria-label="Open notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications > 0 && (
                  <span className="absolute right-1.5 top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadNotifications > 99 ? "99+" : unreadNotifications}
                  </span>
                )}
              </button>
            )}
            <button
              className="text-slate-900"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-border shadow-md">
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-3">
              {navLinks.map((link) => (
                <div key={link.label}>
                  <a
                    href={link.href}
                    className="block py-2 text-sm font-medium text-slate-700 hover:text-slate-900"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </a>
                  {link.children?.map((child) => (
                    <a
                      key={child.label}
                      href={child.href}
                      className="block pl-4 pb-2 text-sm text-slate-500 hover:text-slate-900"
                      onClick={() => setMobileOpen(false)}
                    >
                      {child.label}
                    </a>
                  ))}
                </div>
              ))}
              <div className="pt-3 border-t border-border flex flex-col gap-3">
                {!authed && (
                  <>
                    <a
                      href="/signin"
                      className="text-sm font-medium text-slate-700"
                      onClick={() => setMobileOpen(false)}
                    >
                      Sign In
                    </a>
                    <a
                      href="/register"
                      className="btn-primary text-center text-xs py-2"
                      onClick={() => setMobileOpen(false)}
                    >
                      Become a Member
                    </a>
                  </>
                )}
                {authed && (
                  <>
                    <a
                      href="/dashboard"
                      className="flex items-center gap-3 py-3 border-b border-border"
                      onClick={() => setMobileOpen(false)}
                    >
                      <Avatar
                        seed={user?.username || "Guest"}
                        src={user?.avatarUrl}
                        className="h-10 w-10"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{user?.fullName || user?.username}</span>
                        <span className="text-xs text-muted-foreground">Dashboard & Profile</span>
                      </div>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        setNotificationsOpen(true);
                      }}
                      className="text-left text-sm font-medium text-slate-700 flex items-center gap-2 py-2"
                    >
                      <span className="relative inline-flex">
                        <Bell className="h-4 w-4" />
                        {unreadNotifications > 0 && (
                          <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                            {unreadNotifications > 99 ? "99+" : unreadNotifications}
                          </span>
                        )}
                      </span>
                      Notifications
                    </button>
                    <a
                      href="/messages"
                      className="text-sm font-medium text-slate-700 flex items-center gap-2 py-2"
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="relative inline-flex">
                        <MessageSquare className="h-4 w-4" />
                        {unreadMessages > 0 && (
                          <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                            {unreadMessages > 99 ? "99+" : unreadMessages}
                          </span>
                        )}
                      </span>
                      Messages
                    </a>
                    <button
                      onClick={logout}
                      className="text-left text-sm font-medium text-slate-700 py-2"
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <SheetContent side="right" className="w-full p-0 sm:max-w-md">
        <div className="flex h-full flex-col bg-white">
          <SheetHeader className="border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle>Notifications</SheetTitle>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => void markRead()}
                  className="text-xs font-semibold text-slate-600 transition hover:text-slate-900"
                >
                  Mark all read
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {notificationsLoading ? (
              <div className="px-6 py-10 text-sm text-slate-500">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-sm text-slate-500">No notifications yet.</div>
            ) : (
              notifications.map((notification) => {
                const actorName = notification.actor_full_name || notification.actor_username || "Sports Lounge";
                return (
                  <a
                    key={notification.id}
                    href={notification.link || "/dashboard"}
                    onClick={() => setNotificationsOpen(false)}
                    className="flex gap-3 border-b border-slate-100 px-6 py-4 transition hover:bg-slate-50"
                  >
                    <Avatar
                      seed={actorName}
                      src={notification.actor_avatar_url}
                      name={actorName}
                      className="h-11 w-11 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                        {!notification.read_at && <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary" />}
                      </div>
                      {notification.body && (
                        <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-400">{notificationTimeLabel(notification.created_at)}</p>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default Header;
