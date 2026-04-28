import Header from "@/components/Header";
import { useMemo, useState, useCallback, useEffect } from "react";
import { getAuthUser } from "@/lib/auth";
import { toast } from "sonner";
import {
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Home,
  MessageSquare,
  Trophy,
  MonitorPlay,
  Search,
  Plus,
  Heart,
  Trash2,
  Send,
  Users,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import Avatar from "@/components/Avatar";
import ProfileCompletionWidget, { type ProfileCompletionData } from "@/components/ProfileCompletionWidget";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "@/lib/api";
import { uploadToR2 } from "@/lib/uploads";
import { useUnreadMessagesCount } from "@/hooks/useUnreadMessagesCount";
import { memberNav } from "@/lib/memberNav";

type LinkPreviewData = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  hostname: string;
};

function cleanPostUrl(url: string) {
  return url.replace(/[),.;!?]+$/g, "");
}

function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);

    apiFetch<{ preview: LinkPreviewData }>(`/api/link-preview?url=${encodeURIComponent(url)}`, { auth: false })
      .then((json) => {
        if (!cancelled) setData(json.preview);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) {
    return <div className="mt-3 h-24 rounded-xl border border-border bg-muted/30 animate-pulse" />;
  }

  if (!data || (!data.title && !data.description && !data.image)) return null;

  return (
    <a href={data.url || url} target="_blank" rel="noreferrer" className="block mt-3 border border-border rounded-xl overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors group">
      {data.image && (
        <div className="w-full max-h-56 bg-muted overflow-hidden">
          <img
            src={`/api/link-preview-image?url=${encodeURIComponent(data.image)}`}
            alt=""
            className="w-full max-h-56 object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>
      )}
      <div className="p-3">
        <div className="font-semibold text-sm line-clamp-2 text-foreground">{data.title || data.hostname}</div>
        {data.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{data.description}</div>}
        <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">{data.siteName || data.hostname}</div>
      </div>
    </a>
  );
}

type FeedFilter = "All" | "Business" | "Events" | "Matches";
type MobileTab = "Feed" | "Members" | "Post" | "Events" | "Profile";

type ComposerKind = "Post" | "Business" | "Events" | "Matches" | "Media";

type DashboardResponse = {
  me: {
    id: number;
    email: string;
    username: string;
    membershipTier: string;
    avatarUrl: string | null;
    fullName: string | null;
    role: string | null;
    company: string | null;
  };
  stats: { connections: number; events: number; posts: number };
  feed: Array<{
    id: number;
    kind: FeedFilter | "Post";
    content: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    mediaUrls?: string[];
    createdAt: string;
    stats: { likes: number; comments: number };
    myLike?: boolean;
    mySave?: boolean;
    author: {
      id: number;
      username: string;
      fullName: string | null;
      role: string | null;
      company: string | null;
      avatarUrl: string | null;
    };
  }>;
  upcomingEvents: Array<{ id: number; title: string; startsAt: string; location: string | null; rsvpCount: number }>;
  suggested: Array<{ id: number; username: string; fullName: string | null; role: string | null; avatarUrl: string | null }>;
  onlineNow: Array<{ id: number; username: string; fullName: string | null; lastSeen: string }>;
};

type MeProfileResponse = {
  user: {
    id: number;
    email: string;
    username: string;
  };
  profile: {
    fullName?: string | null;
    role?: string | null;
    company?: string | null;
    bio?: string | null;
    industry?: string | null;
    favoriteSports?: string | null;
    businessInterests?: string | null;
    lookingFor?: string[];
    badges?: string[];
    coverImageUrl?: string | null;
    avatarUrl?: string | null;
    membershipTier?: string | null;
    location?: string | null;
  } | null;
};

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function buildProfileCompletion(data?: MeProfileResponse): ProfileCompletionData | null {
  if (!data) return null;

  const profile = data.profile || {};
  const sections = [
    {
      label: "Profile Info",
      completed: [
        hasText(profile.fullName),
        hasText(profile.role),
        hasText(profile.company),
        hasText(profile.bio),
        hasText(profile.industry),
      ].filter(Boolean).length,
      total: 5,
    },
    {
      label: "Sports & Interests",
      completed: [
        hasText(profile.favoriteSports),
        hasText(profile.businessInterests),
        Array.isArray(profile.lookingFor) && profile.lookingFor.length > 0,
      ].filter(Boolean).length,
      total: 3,
    },
    {
      label: "Contact Info",
      completed: [hasText(data.user.email), hasText(profile.location)].filter(Boolean).length,
      total: 2,
    },
    {
      label: "Profile Photo",
      completed: hasText(profile.avatarUrl) ? 1 : 0,
      total: 1,
    },
    {
      label: "Cover Photo",
      completed: hasText(profile.coverImageUrl) ? 1 : 0,
      total: 1,
    },
  ];

  const completedFields = sections.reduce((sum, section) => sum + section.completed, 0);
  const totalFields = sections.reduce((sum, section) => sum + section.total, 0);
  const percent = Math.round((completedFields / totalFields) * 100);

  return {
    percent,
    completedFields,
    totalFields,
    sections,
  };
}

const Dashboard = () => {
  const navigate = useNavigate();
  const user = useMemo(() => {
    return getAuthUser();
  }, []);

  const name = user?.username || "Member";
  const [filter, setFilter] = useState<FeedFilter>("All");
  const [mobileTab, setMobileTab] = useState<MobileTab>("Feed");
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const unreadMessages = useUnreadMessagesCount();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("dashboard-sidebar-collapsed") === "true";
  });

  useEffect(() => {
    window.localStorage.setItem("dashboard-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const handleSearchKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/members?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const [composerKind, setComposerKind] = useState<ComposerKind>("Post");
  const [composerText, setComposerText] = useState("");
  const [composerMediaFile, setComposerMediaFile] = useState<File | null>(null);
  const [composerMediaPreview, setComposerMediaPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [mobileComposerOpen, setMobileComposerOpen] = useState(false);

  // Like / Save state maps  { postId -> boolean }
  const [likedMap, setLikedMap] = useState<Record<number, boolean>>({});
  const [savedMap, setSavedMap] = useState<Record<number, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});

  // Comment state
  type Comment = { id: number; content: string; created_at: string; user_id: number; username: string; full_name: string | null; avatar_url: string | null };
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState<Record<number, Comment[]>>({});
  const [commentText, setCommentText] = useState<Record<number, string>>({});
  const [commentLoading, setCommentLoading] = useState<Record<number, boolean>>({});
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});

  const toggleComments = async (postId: number, serverCount: number) => {
    const isOpen = openComments[postId];
    setOpenComments((m) => ({ ...m, [postId]: !isOpen }));
    if (!isOpen && !comments[postId]) {
      setCommentLoading((m) => ({ ...m, [postId]: true }));
      try {
        const data = await apiFetch<{ comments: Comment[] }>(`/api/feed/${postId}/comments`);
        setComments((m) => ({ ...m, [postId]: data.comments }));
      } catch { /* silent */ }
      setCommentLoading((m) => ({ ...m, [postId]: false }));
    }
  };

  const submitComment = async (postId: number) => {
    const text = (commentText[postId] || "").trim();
    if (!text) return;
    setCommentText((m) => ({ ...m, [postId]: "" }));
    try {
      const data = await apiFetch<{ comment: Comment }>(`/api/feed/${postId}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text }),
      });
      setComments((m) => ({ ...m, [postId]: [...(m[postId] || []), data.comment] }));
      setCommentCounts((m) => ({ ...m, [postId]: (m[postId] ?? 0) + 1 }));
    } catch { toast.error("Failed to comment"); }
  };

  const deleteComment = async (commentId: number, postId: number) => {
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: "DELETE" });
      setComments((m) => ({ ...m, [postId]: (m[postId] || []).filter((c) => c.id !== commentId) }));
      setCommentCounts((m) => ({ ...m, [postId]: Math.max(0, (m[postId] ?? 1) - 1) }));
    } catch { toast.error("Failed to delete"); }
  };

  const handleLike = useCallback(async (postId: number, currentCount: number) => {
    const prev = likedMap[postId] ?? false;
    setLikedMap((m) => ({ ...m, [postId]: !prev }));
    setLikeCounts((m) => ({ ...m, [postId]: (m[postId] ?? currentCount) + (prev ? -1 : 1) }));
    try {
      const res = await apiFetch<{ liked: boolean; likeCount: number }>(`/api/feed/${postId}/like`, { method: "POST" });
      setLikedMap((m) => ({ ...m, [postId]: res.liked }));
      setLikeCounts((m) => ({ ...m, [postId]: res.likeCount }));
    } catch {
      setLikedMap((m) => ({ ...m, [postId]: prev }));
      setLikeCounts((m) => ({ ...m, [postId]: m[postId] ?? currentCount }));
    }
  }, [likedMap]);

  const handleSave = useCallback(async (postId: number) => {
    const prev = savedMap[postId] ?? false;
    setSavedMap((m) => ({ ...m, [postId]: !prev }));
    try {
      await apiFetch(`/api/feed/${postId}/save`, { method: "POST" });
      toast.success(prev ? "Removed from saved" : "Saved!");
    } catch {
      setSavedMap((m) => ({ ...m, [postId]: prev }));
      toast.error("Failed");
    }
  }, [savedMap]);

  const handleConnect = async (userId: number) => {
    try {
      await apiFetch(`/api/friends/${userId}`, { method: "POST" });
      toast.success("Connection request sent!");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const composerServerKind: DashboardResponse["feed"][number]["kind"] =
    composerKind === "Media" ? "Post" : composerKind;

  const onSelectMediaFile = (file: File | null) => {
    if (composerMediaPreview) URL.revokeObjectURL(composerMediaPreview);
    setComposerMediaFile(file);
    setComposerMediaPreview(file ? URL.createObjectURL(file) : null);
  };

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", filter],
    queryFn: async () => {
      const sp = new URLSearchParams({ filter });
      return apiFetch<DashboardResponse>(`/api/dashboard?${sp.toString()}`);
    },
    staleTime: 15_000,
    retry: (count, err) => {
      const status = (err as ApiError | undefined)?.status;
      if (status === 401) return false;
      return count < 2;
    },
  });

  const profileCompletionQuery = useQuery({
    queryKey: ["me-profile-completion"],
    queryFn: () => apiFetch<MeProfileResponse>("/api/me"),
    staleTime: 30_000,
    retry: (count, err) => {
      const status = (err as ApiError | undefined)?.status;
      if (status === 401) return false;
      return count < 2;
    },
  });

  const profileCompletion = useMemo(
    () => buildProfileCompletion(profileCompletionQuery.data),
    [profileCompletionQuery.data]
  );

  // Initialize like/save state from API data
  useEffect(() => {
    if (dashboardQuery.data?.feed) {
      const lm: Record<number, boolean> = {};
      const sm: Record<number, boolean> = {};
      const lc: Record<number, number> = {};
      const cc: Record<number, number> = {};
      for (const p of dashboardQuery.data.feed) {
        if (likedMap[p.id] === undefined && p.myLike) lm[p.id] = true;
        if (savedMap[p.id] === undefined && p.mySave) sm[p.id] = true;
        lc[p.id] = likeCounts[p.id] ?? p.stats.likes;
        cc[p.id] = commentCounts[p.id] ?? p.stats.comments;
      }
      if (Object.keys(lm).length) setLikedMap((m) => ({ ...lm, ...m }));
      if (Object.keys(sm).length) setSavedMap((m) => ({ ...sm, ...m }));
      setLikeCounts((m) => ({ ...lc, ...m }));
      setCommentCounts((m) => ({ ...cc, ...m }));
    }
  }, [dashboardQuery.data?.feed]);

  const onCreatePost = async () => {
    const content = composerText.trim();
    const hasText = Boolean(content);
    const hasMedia = Boolean(composerMediaFile);
    if (!hasText && !hasMedia) {
      toast.error("Write something or select media before posting.");
      return;
    }
    setPosting(true);
    try {
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;
      if (composerMediaFile) {
        mediaUrl = await uploadToR2(composerMediaFile, "post");
        mediaType = composerMediaFile.type || undefined;
      }

      await apiFetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: composerServerKind,
          content,
          ...(mediaUrl ? { mediaUrl, mediaType } : {}),
        }),
      });
      setComposerText("");
      onSelectMediaFile(null);
      toast.success("Posted");
      // Refresh feed for current filter.
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const onDeletePost = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await apiFetch(`/api/feed/${id}`, { method: "DELETE" });
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete post");
    }
  };

  const goToFeed = () => {
    setMobileTab("Feed");
    navigate("/dashboard");
  };

  return (
    <div className="theme-light h-screen bg-background text-foreground flex flex-col overflow-hidden">
      <Header />

      {/* Mobile top bar */}
      <div className="md:hidden border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="px-4">
          <div className="flex items-center justify-between h-14">
            <Sheet>
              <SheetTrigger asChild>
                <button className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-background">
                  <span className="sr-only">Open menu</span>
                  <span className="text-lg">☰</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="theme-light w-[320px] sm:w-[360px] h-dvh overflow-y-auto overscroll-contain no-scrollbar bg-background text-foreground"
              >
                <SheetHeader>
                  <SheetTitle>Sports Lounge</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        seed={dashboardQuery.data?.me?.username || name}
                        src={dashboardQuery.data?.me?.avatarUrl}
                        name={dashboardQuery.data?.me?.fullName || name}
                        className="h-10 w-10 border border-border"
                      />
                      <div>
                        <div className="font-semibold text-foreground">{name}</div>
                        <div className="text-xs text-muted-foreground">Gold Member</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="text-xs font-semibold text-muted-foreground px-2 py-2">Menu</div>
                    <div className="space-y-1">
                      {memberNav.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            onClick={() => {
                              if (item.href === "/dashboard") goToFeed();
                              else navigate(item.href);
                            }}
                            className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-foreground/90 hover:bg-background hover:text-foreground transition-colors"
                          >
                            <span className="flex items-center gap-3">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{item.label}</span>
                            </span>
                            {item.href === "/messages" && unreadMessages > 0 && (
                              <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {unreadMessages > 99 ? "99+" : unreadMessages}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="text-xs font-semibold text-muted-foreground px-2 py-2">Lounge</div>
                    <div className="space-y-2 px-2 pb-2">
                      <button
                        className="w-full btn-primary text-sm py-2"
                        onClick={() => navigate("/lounge/book")}
                      >
                        Book a Table
                      </button>
                      <button
                        className="w-full border border-border rounded-lg text-sm py-2 hover:bg-background transition-colors"
                        onClick={() => navigate("/lounge/matches")}
                      >
                        View Match Schedule
                      </button>
                      <button
                        className="w-full border border-border rounded-lg text-sm py-2 hover:bg-background transition-colors"
                        onClick={() => navigate("/lounge/perks")}
                      >
                        Member Perks
                      </button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <div className="font-semibold text-foreground">Sports Lounge</div>

            <div className="flex items-center gap-2">
              <button className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-background">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="sr-only">Search</span>
              </button>
              <button
                onClick={() => navigate("/messages")}
                className="relative h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-background"
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                {unreadMessages > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
                <span className="sr-only">Messages</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop premium top bar */}
      <div className="hidden md:block border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground">Member Dashboard</span>
              <span className="text-xs text-muted-foreground hidden lg:inline">
                Private network • Sports • Business • Exclusivity
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  className="bg-transparent outline-none text-sm w-64"
                  placeholder="Search members…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeys}
                />
              </div>
              <a href="/dashboard" className="text-sm font-medium text-foreground hover:opacity-80">
                Home
              </a>
              <a href="/events" className="text-sm font-medium text-foreground/80 hover:text-foreground">
                Events
              </a>
              <a href="/members" className="text-sm font-medium text-foreground/80 hover:text-foreground">
                Members
              </a>
              <a href="/messages" className="relative inline-flex items-center gap-2 text-sm font-medium text-foreground/80 hover:text-foreground">
                <MessageSquare className="h-4 w-4" />
                <span>Messages</span>
                {unreadMessages > 0 && (
                  <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </a>
              <a href={`/profile/${dashboardQuery.data?.me?.username || ""}`} className="text-sm font-medium text-foreground/80 hover:text-foreground">
                Profile
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 3-column layout */}
      <section className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden pb-20 md:pb-0">
        <div className="container mx-auto px-6 h-full">
          <div className="grid grid-cols-1 gap-6 py-8 transition-all duration-300 lg:grid-cols-[minmax(0,1fr)_320px] lg:h-full lg:min-h-0">
            {/* Left sidebar */}
            <aside className="hidden">
              <div className="sticky top-6 space-y-4 lg:h-[calc(100vh-11rem)] lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-2 lg:no-scrollbar">
              <div className={`rounded-xl border border-border bg-card transition-all duration-300 ${sidebarCollapsed ? "p-3" : "p-4"}`}>
                <div className={`flex ${sidebarCollapsed ? "flex-col items-center gap-3" : "items-start justify-between gap-3"}`}>
                  <div
                    className={`cursor-pointer hover:opacity-80 transition-opacity ${sidebarCollapsed ? "flex justify-center" : "flex items-center gap-3"}`}
                    onClick={() => navigate(`/profile/${dashboardQuery.data?.me?.username || name}`)}
                    title={name}
                  >
                    <Avatar
                      seed={dashboardQuery.data?.me?.username || name}
                      src={dashboardQuery.data?.me?.avatarUrl}
                      name={dashboardQuery.data?.me?.fullName || name}
                      className="h-10 w-10 rounded-full"
                    />
                    {!sidebarCollapsed && (
                      <div>
                        <div className="font-semibold text-foreground truncate max-w-[120px]">{name}</div>
                        <div className="text-xs text-muted-foreground">
                          {dashboardQuery.data?.me?.membershipTier || "Gold"} Member
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setSidebarCollapsed((prev) => !prev)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                    title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  >
                    {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </button>
                </div>
                {!sidebarCollapsed && <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-lg border border-border bg-background p-2 text-center">
                    <div className="text-sm font-semibold text-foreground">
                      {dashboardQuery.data?.stats?.connections ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Connections</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-2 text-center">
                    <div className="text-sm font-semibold text-foreground">
                      {dashboardQuery.data?.stats?.events ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Events</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-2 text-center">
                    <div className="text-sm font-semibold text-foreground">
                      {dashboardQuery.data?.stats?.posts ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">Posts</div>
                  </div>
                </div>}
              </div>

              <div className={`rounded-xl border border-border bg-card transition-all duration-300 ${sidebarCollapsed ? "p-2" : "p-3"}`}>
                {!sidebarCollapsed && (
                  <div className="text-xs font-semibold text-muted-foreground px-2 py-2">
                    Navigation
                  </div>
                )}
                <div className="space-y-1">
                  {memberNav.map((item) => {
                    const Icon = item.icon;
                    const isMessagesItem = item.href === "/messages";
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          if (item.href === "/dashboard") goToFeed();
                          else navigate(item.href);
                        }}
                        title={item.label}
                        className={`w-full rounded-lg text-sm text-foreground/90 hover:bg-background hover:text-foreground transition-colors ${
                          sidebarCollapsed
                            ? "flex items-center justify-center px-0 py-2.5"
                            : "flex items-center justify-between gap-3 px-3 py-2"
                        }`}
                      >
                        {sidebarCollapsed ? (
                          <span className="relative inline-flex">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {isMessagesItem && unreadMessages > 0 && (
                              <span className="absolute -right-2.5 -top-2 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                                {unreadMessages > 99 ? "99+" : unreadMessages}
                              </span>
                            )}
                          </span>
                        ) : (
                          <>
                            <span className="flex items-center gap-3">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{item.label}</span>
                            </span>
                            {isMessagesItem && unreadMessages > 0 && (
                              <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {unreadMessages > 99 ? "99+" : unreadMessages}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`rounded-xl border border-border bg-card transition-all duration-300 ${sidebarCollapsed ? "p-2" : "p-3"}`}>
                {!sidebarCollapsed && (
                  <div className="text-xs font-semibold text-muted-foreground px-2 py-2">
                    Lounge Actions
                  </div>
                )}
                <div className={sidebarCollapsed ? "space-y-1" : "space-y-2 px-2 pb-2"}>
                  <button
                    className={sidebarCollapsed ? "w-full inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-card hover:text-foreground" : "w-full btn-primary text-sm py-2"}
                    onClick={() => navigate("/lounge/book")}
                    title="Book a Table"
                  >
                    {sidebarCollapsed ? <CalendarDays className="h-4 w-4" /> : "Book a Table"}
                  </button>
                  <button
                    className={sidebarCollapsed ? "w-full inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-card hover:text-foreground" : "w-full border border-border rounded-lg text-sm py-2 hover:bg-background transition-colors"}
                    onClick={() => navigate("/lounge/matches")}
                    title="View Match Schedule"
                  >
                    {sidebarCollapsed ? <MonitorPlay className="h-4 w-4" /> : "View Match Schedule"}
                  </button>
                  <button
                    className={sidebarCollapsed ? "w-full inline-flex items-center justify-center rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-card hover:text-foreground" : "w-full border border-border rounded-lg text-sm py-2 hover:bg-background transition-colors"}
                    onClick={() => navigate("/lounge/perks")}
                    title="Member Perks"
                  >
                    {sidebarCollapsed ? <Trophy className="h-4 w-4" /> : "Member Perks"}
                  </button>
                </div>
              </div>
              </div>
            </aside>

            {/* Main feed */}
            <main className="space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-2 lg:no-scrollbar">
              {/* Mobile: tab-specific content wrapper */}
              <div className="md:hidden">
                {mobileTab !== "Feed" && (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="font-semibold text-foreground">
                      {mobileTab === "Members"
                        ? "Members Network"
                        : mobileTab === "Events"
                          ? "Events"
                          : mobileTab === "Profile"
                            ? "Profile"
                            : "Create Post"}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      {mobileTab === "Members"
                        ? "Search members and connect."
                        : mobileTab === "Events"
                          ? "Browse upcoming events and RSVP."
                          : mobileTab === "Profile"
                            ? "Your member profile (coming next)."
                            : "Create a post (coming next)."}
                    </div>
                    {mobileTab === "Members" ? (
                      <button
                        type="button"
                        onClick={() => navigate("/members")}
                        className="mt-4 btn-primary text-sm py-2 px-4"
                      >
                        Open Members Network
                      </button>
                    ) : null}
                    {mobileTab === "Profile" ? (
                      <button
                        type="button"
                        onClick={() => navigate("/profile")}
                        className="mt-4 btn-primary text-sm py-2 px-4"
                      >
                        Open Profile
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              {profileCompletion && profileCompletion.percent < 100 ? (
                <div className="lg:hidden">
                  <ProfileCompletionWidget
                    data={profileCompletion}
                    onOpenProfile={() => navigate("/profile")}
                  />
                </div>
              ) : null}

              {/* Mobile: compact create post */}
              <div className="md:hidden rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    seed={dashboardQuery.data?.me?.username || name}
                    src={dashboardQuery.data?.me?.avatarUrl}
                    name={dashboardQuery.data?.me?.fullName || name}
                    className="h-9 w-9 border border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setMobileComposerOpen(true)}
                    className="flex-1 text-left text-sm text-muted-foreground border border-border rounded-full px-4 py-2 bg-background hover:bg-card transition-colors"
                  >
                    What’s happening?
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                  {[
                    { label: "📝", sr: "Post", kind: "Post" as const },
                    { label: "🤝", sr: "Business", kind: "Business" as const },
                    { label: "📅", sr: "Event", kind: "Events" as const },
                    { label: "📸", sr: "Media", kind: "Media" as const },
                  ].map((i) => (
                    <button
                      key={i.sr}
                      type="button"
                      onClick={() => {
                        setComposerKind(i.kind);
                        setMobileComposerOpen(true);
                      }}
                      aria-pressed={composerKind === i.kind}
                      disabled={posting}
                      className="h-10 w-16 rounded-xl border border-border bg-background text-base hover:bg-card transition-colors"
                    >
                      <span className="sr-only">{i.sr}</span>
                      <span
                        className={
                          composerKind === i.kind
                            ? "inline-flex items-center justify-center opacity-100"
                            : "inline-flex items-center justify-center opacity-85"
                        }
                      >
                        {i.label}
                      </span>
                    </button>
                  ))}
                </div>

                {mobileComposerOpen ? (
                  <div className="mt-4 space-y-3">
                    <textarea
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      className="w-full min-h-[72px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Share an update…"
                    />
                    {composerKind === "Media" ? (
                      <div className="rounded-xl border border-border bg-background p-3">
                        <div className="text-xs font-semibold text-muted-foreground">Upload photo/video</div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <label className="btn-primary text-sm py-2 px-3 inline-flex items-center gap-2 cursor-pointer">
                            <span>Choose file</span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={(e) => onSelectMediaFile(e.target.files?.[0] || null)}
                            />
                          </label>
                          {composerMediaPreview ? (
                            <button
                              type="button"
                              className="px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-card transition-colors"
                              onClick={() => onSelectMediaFile(null)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        {composerMediaPreview ? (
                          <div className="mt-3">
                            {composerMediaFile?.type.startsWith("video") ? (
                              <video
                                src={composerMediaPreview}
                                className="w-full rounded-lg border border-border"
                                controls
                              />
                            ) : (
                              <img
                                src={composerMediaPreview}
                                alt="Upload preview"
                                className="w-full rounded-lg border border-border object-cover max-h-56"
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setMobileComposerOpen(false)}
                        disabled={posting}
                        className="px-4 py-2 rounded-lg border border-border bg-background text-sm font-semibold disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={onCreatePost}
                        disabled={posting || (!composerText.trim() && !composerMediaFile)}
                        className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
                      >
                        {posting ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Desktop: full create post */}
              <div className="hidden md:block rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar
                    seed={dashboardQuery.data?.me?.username || name}
                    src={dashboardQuery.data?.me?.avatarUrl}
                    name={dashboardQuery.data?.me?.fullName || name}
                    className="h-10 w-10 border border-border"
                  />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-2">
                      What’s happening, <span className="text-foreground font-medium">{name}</span>?
                    </div>
                    <textarea
                      className="w-full min-h-[96px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      placeholder="Share an update, a business opportunity, or match plans…"
                    />
                    {composerKind === "Media" ? (
                      <div className="mt-3 rounded-xl border border-border bg-background p-3">
                        <div className="text-xs font-semibold text-muted-foreground">Upload photo/video</div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <label className="btn-primary text-sm py-2 px-3 inline-flex items-center gap-2 cursor-pointer">
                            <span>Choose file</span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              onChange={(e) => onSelectMediaFile(e.target.files?.[0] || null)}
                            />
                          </label>
                          {composerMediaPreview ? (
                            <button
                              type="button"
                              className="px-3 py-2 rounded-lg border border-border bg-background text-sm hover:bg-card transition-colors"
                              onClick={() => onSelectMediaFile(null)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                        {composerMediaPreview ? (
                          <div className="mt-3">
                            {composerMediaFile?.type.startsWith("video") ? (
                              <video src={composerMediaPreview} className="w-full rounded-lg border border-border" controls />
                            ) : (
                              <img
                                src={composerMediaPreview}
                                alt="Upload preview"
                                className="w-full rounded-lg border border-border object-cover max-h-56"
                              />
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: "📝 Post", kind: "Post" as const },
                          { label: "🤝 Business", kind: "Business" as const },
                          { label: "📅 Event", kind: "Events" as const },
                          { label: "📸 Media", kind: "Media" as const },
                        ].map((t) => (
                          <button
                            key={t.label}
                            type="button"
                            onClick={() => setComposerKind(t.kind)}
                            aria-pressed={composerKind === t.kind}
                            disabled={posting}
                            className={
                              composerKind === t.kind
                                ? "px-3 py-1.5 rounded-full border border-slate-900 bg-slate-900 text-xs font-medium text-white"
                                : "px-3 py-1.5 rounded-full border border-border text-xs font-medium hover:bg-background transition-colors"
                            }
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={onCreatePost}
                        disabled={posting || (!composerText.trim() && !composerMediaFile)}
                        className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        {posting ? "Posting..." : "Post"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {(["All", "Business", "Events", "Matches"] as FeedFilter[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      filter === t
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-card text-foreground border-border hover:bg-background"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {dashboardQuery.isLoading ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Loading feed…
                </div>
              ) : dashboardQuery.isError ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Failed to load dashboard.{" "}
                  {dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "Please try again."}
                </div>
              ) : !dashboardQuery.data?.feed?.length ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  No posts yet. Be the first to share an update.
                </div>
              ) : (
                dashboardQuery.data.feed.map((p) => {
                  const authorName = p.author.fullName || p.author.username || "Member";
                  const authorRole = p.author.role || (p.author.company ? `Member • ${p.author.company}` : "Member");
                  const when = new Date(p.createdAt).toLocaleString();
                  const allMedia = (p.mediaUrls && p.mediaUrls.length > 0) ? p.mediaUrls : (p.mediaUrl ? [p.mediaUrl] : []);
                  const isLiked = likedMap[p.id] ?? false;
                  const isSaved = savedMap[p.id] ?? false;
                  const likeCount = likeCounts[p.id] ?? p.stats.likes;
                  
                  const kindOptions: Record<string, { label: string, color: string, border: string, bg: string }> = {
                    Business: { label: "🤝 Business", color: "text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40", border: "border-l-amber-500", bg: "bg-gradient-to-r from-amber-500/10 to-transparent" },
                    Events: { label: "📅 Event", color: "text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40", border: "border-l-emerald-500", bg: "bg-gradient-to-r from-emerald-500/10 to-transparent" },
                    Matches: { label: "⚽ Match", color: "text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40", border: "border-l-blue-500", bg: "bg-gradient-to-r from-blue-500/10 to-transparent" },
                    Media: { label: "📸 Media", color: "text-purple-800 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40", border: "border-l-purple-500", bg: "bg-gradient-to-r from-purple-500/10 to-transparent" },
                  };
                  const kindStyle = kindOptions[p.kind];
                  
                  return (
                    <div 
                      key={p.id} 
                      className={`relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-300 ${kindStyle ? `border-l-4 ${kindStyle.border}` : ""}`}
                    >
                      {kindStyle && <div className={`absolute -inset-x-4 -top-4 h-20 pointer-events-none ${kindStyle.bg}`} />}
                      <div className="relative z-10 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar seed={authorName} name={authorName} src={p.author.avatarUrl || undefined} className="h-10 w-10 ring-2 ring-background shadow-sm" />
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              {authorName}
                              {kindStyle && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${kindStyle.color}`}>
                                  {kindStyle.label}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{authorRole}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground">{when}</div>
                          {p.author.id === dashboardQuery.data?.me?.id && (
                            <button
                              onClick={() => onDeletePost(p.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
                              title="Delete Post"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleSave(p.id)}
                            className={`p-1.5 rounded-lg transition-colors ${isSaved ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Multi-photo grid */}
                      {allMedia.length > 0 && (
                        <div className={`mt-3 rounded-lg overflow-hidden grid gap-0.5 ${
                          allMedia.length === 1 ? "" :
                          allMedia.length === 2 ? "grid-cols-2" :
                          "grid-cols-2"
                        }`}>
                          {allMedia.slice(0, 4).map((url, idx) => (
                            <div
                              key={idx}
                              className={`relative bg-muted ${
                                allMedia.length === 3 && idx === 0 ? "row-span-2" :
                                allMedia.length === 1 ? "" : ""
                              }`}
                            >
                              {p.mediaType?.startsWith("video") ? (
                                <video src={url} className="w-full h-full object-contain" controls />
                              ) : (
                                <img
                                  src={url}
                                  alt=""
                                  className={`w-full object-contain ${
                                    allMedia.length === 1 ? "max-h-[480px]" : "h-48"
                                  }`}
                                />
                              )}
                              {idx === 3 && allMedia.length > 4 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-2xl">
                                  +{allMedia.length - 4}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {p.content ? (
                        <div className="mt-3 text-sm text-foreground/90 whitespace-pre-line">
                          {(() => {
                            const urlRegex = /(https?:\/\/[^\s]+)/g;
                            const parts = p.content.split(urlRegex);
                            const matches = (p.content.match(urlRegex) || []).map(cleanPostUrl);
                            const firstUrl = matches[0];
                            return (
                              <>
                                <div>
                                  {parts.map((part, i) => {
                                    if (part.match(urlRegex)) {
                                      const href = cleanPostUrl(part);
                                      return (
                                        <a key={i} href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                                          {href}
                                        </a>
                                      );
                                    }
                                    return <span key={i}>{part}</span>;
                                  })}
                                </div>
                                {firstUrl && allMedia.length === 0 && <LinkPreview url={firstUrl} />}
                              </>
                            );
                          })()}
                        </div>
                      ) : null}

                      {/* Reaction bar */}
                      <div className="mt-4 flex items-center justify-between text-sm border-t border-border/50 pt-3">
                        <div className="text-muted-foreground text-xs">
                          👍 {likeCount} &nbsp; 💬 {commentCounts[p.id] ?? p.stats.comments}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLike(p.id, p.stats.likes)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              isLiked
                                ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                                : "border-border hover:bg-background"
                            }`}
                          >
                            <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-current" : ""}`} />
                            {isLiked ? "Liked" : "Like"}
                          </button>
                          <button 
                            onClick={() => toggleComments(p.id, p.stats.comments)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              openComments[p.id] ? "bg-muted text-foreground border-border" : "border-border hover:bg-background text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> Comment
                          </button>
                        </div>
                      </div>

                      {/* Comment Section */}
                      {openComments[p.id] && (
                        <div className="mt-3 pt-3 border-t border-border/30 px-1">
                          {/* Add Comment Input */}
                          <div className="flex gap-3 items-start mb-4">
                            <Avatar seed={name} src={dashboardQuery.data?.me?.avatarUrl} name={name} className="h-8 w-8 mt-1" />
                            <div className="flex-1 bg-muted/50 border border-border rounded-xl focus-within:ring-1 focus-within:ring-primary focus-within:border-primary overflow-hidden transition-all">
                              <textarea
                                value={commentText[p.id] || ""}
                                onChange={(e) => setCommentText(m => ({ ...m, [p.id]: e.target.value }))}
                                placeholder="Write a comment..."
                                className="w-full bg-transparent border-none px-3 py-2 text-sm outline-none resize-none min-h-[44px]"
                                rows={1}
                              />
                              {(commentText[p.id] || "").trim().length > 0 && (
                                <div className="flex justify-end p-2 border-t border-border bg-card/50">
                                  <button
                                    onClick={() => submitComment(p.id)}
                                    className="bg-primary text-primary-foreground hover:bg-primary/90 text-[11px] font-semibold px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
                                  >
                                    <Send className="h-3 w-3" /> Post
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Comments List */}
                          <div className="space-y-3">
                            {commentLoading[p.id] ? (
                              <div className="text-xs text-muted-foreground text-center py-2 animate-pulse">Loading comments...</div>
                            ) : comments[p.id]?.length > 0 ? (
                              comments[p.id].map(c => (
                                <div key={c.id} className="flex gap-3 group">
                                  <Avatar seed={c.full_name || c.username} src={c.avatar_url} name={c.full_name || c.username} className="h-8 w-8" />
                                  <div className="flex-1">
                                    <div className="bg-muted px-3 py-2 min-h-[40px] rounded-2xl rounded-tl-sm w-fit inline-block items-center border border-border/40">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs font-semibold leading-none">{c.full_name || c.username}</span>
                                      </div>
                                      <div className="text-sm text-foreground/90 leading-snug whitespace-pre-wrap breakdown-words">{c.content}</div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 ml-2 text-[10px] text-muted-foreground font-medium">
                                      <span>{new Date(c.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}</span>
                                      {c.user_id === dashboardQuery.data?.me?.id && (
                                        <button 
                                          onClick={() => deleteComment(c.id, p.id)}
                                          className="hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-muted-foreground text-center py-4 bg-muted/30 rounded-lg border border-border/30">
                                No comments yet. Be the first to reply.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </main>

            {/* Right sidebar */}
            <aside className="hidden lg:block space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:no-scrollbar">
              {profileCompletion && profileCompletion.percent < 100 ? (
                <ProfileCompletionWidget
                  data={profileCompletion}
                  onOpenProfile={() => navigate("/profile")}
                />
              ) : null}

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="font-semibold text-foreground mb-3">Upcoming Events</div>
                <div className="space-y-3">
                  {dashboardQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : dashboardQuery.data?.upcomingEvents?.length ? (
                    dashboardQuery.data.upcomingEvents.map((e) => (
                      <div key={e.id} className="rounded-lg border border-border bg-background p-3">
                        <div className="text-sm font-semibold text-foreground">{e.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(e.startsAt).toLocaleString()}
                          {e.location ? ` • ${e.location}` : ""}
                        </div>
                        <button
                          onClick={() => navigate("/events")}
                          className="mt-3 w-full border border-border rounded-lg text-sm py-2 hover:bg-card transition-colors"
                        >
                          RSVP
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No upcoming events yet.</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="font-semibold text-foreground mb-3">People You Should Meet</div>
                <div className="space-y-3">
                  {dashboardQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : dashboardQuery.data?.suggested?.length ? (
                    dashboardQuery.data.suggested.map((m) => {
                      const display = m.fullName || m.username || "Member";
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar seed={display} name={display} src={m.avatarUrl || undefined} className="h-9 w-9" />
                            <div>
                              <div className="text-sm font-semibold text-foreground">{display}</div>
                              <div className="text-xs text-muted-foreground">{m.role || "Member"}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleConnect(m.id)}
                            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-background transition-colors"
                          >
                            Connect
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground">No suggestions yet.</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="font-semibold text-foreground mb-3">Online Now</div>
                <div className="space-y-2 text-sm text-foreground/90">
                  {dashboardQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground">Loading…</div>
                  ) : dashboardQuery.data?.onlineNow?.length ? (
                    dashboardQuery.data.onlineNow.slice(0, 8).map((n) => (
                      <div key={n.id} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span>{n.fullName || n.username}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No one active right now.</div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="font-semibold text-foreground mb-3">Quick Actions</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="rounded-lg border border-border bg-background py-2 text-sm hover:bg-card transition-colors">+ Create Post</button>
                  <button onClick={() => navigate("/lounge/book")} className="rounded-lg border border-border bg-background py-2 text-sm hover:bg-card transition-colors">+ Book Table</button>
                  <button onClick={() => navigate("/messages")} className="rounded-lg border border-border bg-background py-2 text-sm hover:bg-card transition-colors">+ Start Chat</button>
                  <button onClick={() => navigate("/events")} className="rounded-lg border border-border bg-background py-2 text-sm hover:bg-card transition-colors">+ Create Event</button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="px-2 py-2">
          <div className="grid grid-cols-5 gap-1">
            <button
              onClick={() => {
                goToFeed();
              }}
              className={`h-12 rounded-xl flex flex-col items-center justify-center text-xs ${
                mobileTab === "Feed" ? "bg-background border border-border" : "text-muted-foreground"
              }`}
            >
              <Home className="h-5 w-5" />
              <span className="mt-0.5">Feed</span>
            </button>
            <button
              onClick={() => {
                setMobileTab("Members");
                navigate("/members");
              }}
              className={`h-12 rounded-xl flex flex-col items-center justify-center text-xs ${
                mobileTab === "Members" ? "bg-background border border-border" : "text-muted-foreground"
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="mt-0.5">Members</span>
            </button>
            <button
              onClick={() => setMobileTab("Post")}
              className="h-12 rounded-xl flex flex-col items-center justify-center text-xs bg-gradient-to-b from-[#d4af37] to-[#b48b1e] text-black font-semibold border border-[#b48b1e]"
            >
              <Plus className="h-5 w-5" />
              <span className="mt-0.5">Post</span>
            </button>
            <button
              onClick={() => {
                setMobileTab("Events");
                navigate("/events");
              }}
              className={`h-12 rounded-xl flex flex-col items-center justify-center text-xs ${
                mobileTab === "Events" ? "bg-background border border-border" : "text-muted-foreground"
              }`}
            >
              <CalendarDays className="h-5 w-5" />
              <span className="mt-0.5">Events</span>
            </button>
            <button
              onClick={() => {
                setMobileTab("Profile");
                navigate("/profile");
              }}
              className={`h-12 rounded-xl flex flex-col items-center justify-center text-xs ${
                mobileTab === "Profile" ? "bg-background border border-border" : "text-muted-foreground"
              }`}
            >
              <Avatar seed={name} name={name} className="h-5 w-5 text-[9px]" />
              <span className="mt-0.5">Profile</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;

