import Header from "@/components/Header";
import { useMemo, useState, useCallback, useEffect } from "react";
import { getAuthUser } from "@/lib/auth";
import { toast } from "sonner";
import {
  CalendarDays,
  Home,
  Users,
  MessageSquare,
  Trophy,
  MapPin,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  MonitorPlay,
  Search,
  Plus,
  Heart,
  Trash2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import Avatar from "@/components/Avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, type ApiError } from "@/lib/api";
import { uploadToR2 } from "@/lib/uploads";

function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.status === "success") setData(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [url]);

  if (loading || !data) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mt-2 text-primary hover:underline break-all text-sm">
        {url}
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block mt-3 border border-border rounded-xl overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors group">
      {data.image?.url && (
        <div className="w-full h-48 bg-muted overflow-hidden">
          <img src={data.image.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      <div className="p-3">
        <div className="font-semibold text-sm line-clamp-1 text-foreground">{data.title || url}</div>
        {data.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{data.description}</div>}
        <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wider">{new URL(url).hostname}</div>
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

const Dashboard = () => {
  const navigate = useNavigate();
  const user = useMemo(() => {
    return getAuthUser();
  }, []);

  const name = user?.username || "Member";
  const [filter, setFilter] = useState<FeedFilter>("All");
  const [mobileTab, setMobileTab] = useState<MobileTab>("Feed");
  const queryClient = useQueryClient();

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

  const nav = [
    { label: "Feed", icon: Home, href: "/dashboard" },
    { label: "Members Network", icon: Users, href: "/members" },
    { label: "Messages", icon: MessageSquare, href: "/messages" },
    { label: "Events", icon: CalendarDays, href: "/events" },
    { label: "Live Matches", icon: MonitorPlay, href: "/matches" },
    { label: "Business Hub", icon: BriefcaseBusiness, href: "/business" },
    { label: "Leaderboard", icon: Trophy, href: "/leaderboard" },
    { label: "Lounge Locations", icon: MapPin, href: "/lounges" },
    { label: "Saved", icon: Bookmark, href: "/saved" },
  ];

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
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#d4af37] via-[#1e346b] to-[#0b0f1a]" />
                      <div>
                        <div className="font-semibold text-foreground">{name}</div>
                        <div className="text-xs text-muted-foreground">Gold Member</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="text-xs font-semibold text-muted-foreground px-2 py-2">Menu</div>
                    <div className="space-y-1">
                      {[
                        { label: "Feed", icon: Home, href: "/dashboard" },
                        { label: "Members", icon: Users, href: "/members" },
                        { label: "Messages", icon: MessageSquare, href: "/messages" },
                        { label: "Events", icon: CalendarDays, href: "/events" },
                        { label: "Live Matches", icon: MonitorPlay, href: "/matches" },
                        { label: "Business Hub", icon: BriefcaseBusiness, href: "/business" },
                        { label: "Lounges", icon: MapPin, href: "/lounges" },
                        { label: "Leaderboard", icon: Trophy, href: "/leaderboard" },
                        { label: "Saved", icon: Bookmark, href: "/saved" },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            onClick={() => {
                              if (item.href === "/dashboard") goToFeed();
                              else navigate(item.href);
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground/90 hover:bg-background hover:text-foreground transition-colors"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span>{item.label}</span>
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
              <button className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border bg-background">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
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
                  placeholder="Search members, events, matches…"
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
              <a href="/messages" className="text-sm font-medium text-foreground/80 hover:text-foreground">
                Messages
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
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-6 lg:h-full lg:min-h-0 py-8">
            {/* Left sidebar */}
            <aside className="hidden lg:block space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-2 lg:no-scrollbar">
              <div className="rounded-xl border border-border bg-card p-4">
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/profile/${dashboardQuery.data?.me?.username || name}`)}
                >
                  <Avatar
                    seed={dashboardQuery.data?.me?.username || name}
                    src={dashboardQuery.data?.me?.avatarUrl}
                    name={dashboardQuery.data?.me?.fullName || name}
                    className="h-10 w-10 rounded-full"
                  />
                  <div>
                    <div className="font-semibold text-foreground truncate max-w-[120px]">{name}</div>
                    <div className="text-xs text-muted-foreground">
                      {dashboardQuery.data?.me?.membershipTier || "Gold"} Member
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
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
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-2">
                  Navigation
                </div>
                <div className="space-y-1">
                  {nav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          if (item.href === "/dashboard") goToFeed();
                          else navigate(item.href);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground/90 hover:bg-background hover:text-foreground transition-colors"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-xs font-semibold text-muted-foreground px-2 py-2">
                  Lounge Actions
                </div>
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

              {/* Mobile: compact create post */}
              <div className="md:hidden rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#1e346b] to-[#d4af37]" />
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
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1e346b] to-[#d4af37]" />
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
                  return (
                    <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar seed={authorName} name={authorName} src={p.author.avatarUrl || undefined} className="h-10 w-10" />
                          <div>
                            <div className="font-semibold text-foreground">{authorName}</div>
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
                            const matches = p.content.match(urlRegex) || [];
                            const firstUrl = matches[0];
                            return (
                              <>
                                <div>
                                  {parts.map((part, i) => {
                                    if (part.match(urlRegex)) {
                                      return (
                                        <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                                          {part}
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
                          👍 {likeCount} &nbsp; 💬 {p.stats.comments}
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
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-background text-xs font-medium transition-colors">
                            💬 Comment
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </main>

            {/* Right sidebar */}
            <aside className="hidden lg:block space-y-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:no-scrollbar">
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
                        <button className="mt-3 w-full border border-border rounded-lg text-sm py-2 hover:bg-card transition-colors">
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
                          <button className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-background transition-colors">
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
                  {["+ Create Post", "+ Book Table", "+ Start Chat", "+ Create Event"].map((a) => (
                    <button
                      key={a}
                      className="rounded-lg border border-border bg-background py-2 text-sm hover:bg-card transition-colors"
                    >
                      {a}
                    </button>
                  ))}
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

