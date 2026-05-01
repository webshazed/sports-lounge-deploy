import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import Avatar from "@/components/Avatar";
import { getAuthUser, isAuthed, AUTH_CHANGED_EVENT } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { memberNav, isMemberNavActive } from "@/lib/memberNav";
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessagesCount";

type SubscriptionResponse = {
  subscription: { status: string } | null;
};

const BODY_CLASS_COLLAPSED = "member-rail-collapsed";
const BODY_CLASS_EXPANDED = "member-rail-expanded";

export default function MemberLeftRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => isAuthed());
  const [authUser, setAuthUser] = useState(() => getAuthUser());
  const unreadMessages = useUnreadMessagesCount({ enabled: authed });
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("member-sidebar-collapsed");
    if (stored == null) return true;
    return stored === "true";
  });

  const subscriptionQuery = useQuery({
    queryKey: ["member-left-rail-subscription", authUser?.id],
    queryFn: () => apiFetch<SubscriptionResponse>("/api/subscription"),
    enabled: authed,
    staleTime: 60_000,
    retry: 1,
  });

  const showRail = authed && subscriptionQuery.data?.subscription?.status === "active";

  useEffect(() => {
    window.localStorage.setItem("member-sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const onAuthChanged = () => {
      setAuthed(isAuthed());
      setAuthUser(getAuthUser());
      void subscriptionQuery.refetch();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener("storage", onAuthChanged);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener("storage", onAuthChanged);
    };
  }, [subscriptionQuery]);

  useEffect(() => {
    setAuthed(isAuthed());
    setAuthUser(getAuthUser());
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.remove(BODY_CLASS_COLLAPSED, BODY_CLASS_EXPANDED);
    if (!showRail) return;

    document.body.classList.add(collapsed ? BODY_CLASS_COLLAPSED : BODY_CLASS_EXPANDED);
    return () => {
      document.body.classList.remove(BODY_CLASS_COLLAPSED, BODY_CLASS_EXPANDED);
    };
  }, [collapsed, showRail]);

  if (!showRail) return null;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 hidden overflow-hidden border-r border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.10)] transition-[width,box-shadow] duration-300 ease-out lg:flex lg:flex-col ${
        collapsed ? "w-[88px]" : "w-[244px]"
      }`}
    >
      <div
        className={`flex min-h-[78px] items-center border-b border-slate-200 bg-white px-4 py-4 ${
          collapsed ? "justify-center" : "justify-end"
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white px-3 py-5">
        <nav className="space-y-2">
          {memberNav.map((item) => {
            const Icon = item.icon;
            const isActive = isMemberNavActive(location.pathname, item);
            const isMessagesItem = item.href === "/messages";
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.href)}
                title={item.label}
                className={`group relative flex w-full items-center rounded-2xl transition-all duration-200 ease-out ${
                  collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-3"
                } ${
                  isActive
                    ? "bg-gradient-to-b from-[#3b5998] to-[#1e346b] text-white shadow-lg shadow-[#1e346b]/20"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {collapsed && (
                  <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xl group-hover:block">
                    {item.label}
                  </span>
                )}
                <span className="relative inline-flex">
                  <Icon className={`h-5 w-5 ${isActive ? "text-white" : "text-black group-hover:text-black"}`} />
                  {isMessagesItem && unreadMessages > 0 && (
                    <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                      {unreadMessages > 99 ? "99+" : unreadMessages}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <span className="truncate text-sm font-semibold">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 bg-white px-3 py-4">
        <button
          type="button"
          onClick={() => navigate(authUser?.username ? `/profile/${authUser.username}` : "/profile")}
          className={`group relative flex w-full items-center rounded-2xl transition-all duration-200 ease-out hover:bg-slate-50 ${
            collapsed ? "justify-center px-0 py-3" : "gap-3 px-3 py-3"
          }`}
          title="Profile"
        >
          {collapsed && (
            <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-xl group-hover:block">
              Profile
            </span>
          )}
          {authUser?.username ? (
            <Avatar
              seed={authUser.username}
              src={authUser.avatarUrl}
              name={authUser.fullName || authUser.username}
              className="h-10 w-10 ring-1 ring-slate-200"
            />
          ) : (
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
              <User className="h-5 w-5 text-slate-500" />
            </span>
          )}
          {!collapsed && (
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-semibold text-slate-900">
                {authUser?.fullName || authUser?.username || "Member"}
              </div>
              <div className="text-xs text-slate-500">View profile</div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}
