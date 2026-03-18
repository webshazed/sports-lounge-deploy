import Header from "@/components/Header";
import { useMemo, useState } from "react";
import { getAuthUser } from "@/lib/auth";
import {
  CalendarDays,
  Home,
  Users,
  MessageSquare,
  Trophy,
  MapPin,
  Bookmark,
  BriefcaseBusiness,
  MonitorPlay,
  Search,
  Plus,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import Avatar from "@/components/Avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type FeedFilter = "All" | "Business" | "Events" | "Matches";
type MobileTab = "Feed" | "Members" | "Post" | "Events" | "Profile";

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
    hasLiked?: boolean;
    reactions?: Record<string, number>;
    userReaction?: string | null;
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
  onlineNow: Array<{ id: number; username: string; fullName: string | null; avatarUrl: string | null; lastSeen: string }>;
};

const REACTION_EMOJIS: Record<string, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡"
};

const PostItem = ({ p, queryClient, filter }: { p: DashboardResponse["feed"][0], queryClient: any, filter: FeedFilter }) => {
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [showReactions, setShowReactions] = useState(false);

  const reactMutation = useMutation({
    mutationFn: async (reaction: string) => {
      if (p.userReaction === reaction) {
        return apiFetch(`/api/feed/${p.id}/react`, { method: "DELETE" });
      }
      return apiFetch(`/api/feed/${p.id}/react`, { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction })
      });
    },
    onMutate: async (reaction: string) => {
      await queryClient.cancelQueries({ queryKey: ["dashboard"] });
      queryClient.setQueryData(["dashboard", filter], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          feed: old.feed.map((post: any) => {
            if (post.id === p.id) {
              const prevReaction = post.userReaction;
              const isToggleOff = prevReaction === reaction;
              const newReaction = isToggleOff ? null : reaction;
              
              const newReactions = { ...(post.reactions || {}) };
              if (prevReaction) {
                newReactions[prevReaction] = Math.max(0, (newReactions[prevReaction] || 1) - 1);
              }
              if (!isToggleOff) {
                newReactions[reaction] = (newReactions[reaction] || 0) + 1;
              }
              
              return { 
                ...post, 
                userReaction: newReaction,
                reactions: newReactions,
                stats: {
                  ...post.stats,
                  likes: Object.values(newReactions).reduce((a: any, b: any) => a + b, 0)
                }
              };
            }
            return post;
          })
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });

  const handleReactionClick = (reaction: string) => {
    setShowReactions(false);
    reactMutation.mutate(reaction);
  };

  const commentMutation = useMutation({
    mutationFn: async ({ parentId }: { parentId?: number } = {}) => {
      if (!commentText.trim()) return;
      return apiFetch(`/api/feed/${p.id}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText, parentId }),
      });
    },
    onSuccess: () => {
      setCommentText("");
      setReplyingTo(null);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["comments", p.id] });
    }
  });

  const commentsQuery = useQuery({
    queryKey: ["comments", p.id],
    queryFn: () => apiFetch<{ comments: any[] }>(`/api/feed/${p.id}/comments`),
    enabled: showComments,
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/dashboard?post=${p.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Sports Lounge Post", url });
      } catch (e) {
        // user cancelled or error
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  const authorName = p.author.fullName || p.author.username || "Member";
  const authorRole = p.author.role || (p.author.company ? `Member • ${p.author.company}` : "Member");
  const when = new Date(p.createdAt).toLocaleString();

  const organizeComments = (comments: any[]) => {
    const map = new Map<number, any>();
    const roots: any[] = [];
    comments.forEach(c => map.set(c.id, { ...c, replies: [] }));
    comments.forEach(c => {
      if (c.parentId) {
        const parent = map.get(c.parentId);
        if (parent) parent.replies.push(map.get(c.id));
      } else {
        roots.push(map.get(c.id));
      }
    });
    return roots;
  };

  const nestedComments = commentsQuery.data?.comments ? organizeComments(commentsQuery.data.comments) : [];

  const CommentNode = ({ comment, isReply = false }: { comment: any, isReply?: boolean }) => {
    return (
      <div className={`flex gap-3 ${isReply ? 'mt-3 ms-2' : ''}`}>
        <Avatar seed={comment.author.fullName || comment.author.username} name={comment.author.fullName || comment.author.username} src={comment.author.avatarUrl || undefined} className="h-8 w-8" />
        <div className="flex-1">
          <div className="bg-background rounded-b-lg rounded-tr-lg p-3 text-sm border border-border">
            <div className="font-semibold">{comment.author.fullName || comment.author.username}</div>
            <div className="mt-1">{comment.content}</div>
          </div>
          <div className="flex items-center gap-3 mt-1 ms-1 text-xs text-muted-foreground">
            <button 
              className="hover:text-foreground font-medium transition-colors"
              onClick={() => {
                setReplyingTo(comment.id);
                setCommentText("");
              }}
            >
              Reply
            </button>
            <span>{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}</span>
          </div>
          
          {replyingTo === comment.id && (
            <div className="mt-2 mb-3 flex gap-2">
              <input 
                type="text" 
                autoFocus
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={`Reply to ${comment.author.fullName || comment.author.username}...`} 
                className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-1.5 outline-none focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commentMutation.mutate({ parentId: comment.id });
                  }
                }}
              />
              <button 
                onClick={() => commentMutation.mutate({ parentId: comment.id })}
                disabled={commentMutation.isPending || !commentText.trim()}
                className="btn-primary text-xs px-3 rounded-lg disabled:opacity-50"
              >
                Reply
              </button>
              <button 
                onClick={() => {
                  setReplyingTo(null);
                  setCommentText("");
                }}
                className="text-muted-foreground text-xs hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div className="border-l-2 border-border/50 pl-2 ml-1">
              {comment.replies.map((reply: any) => (
                <CommentNode key={reply.id} comment={reply} isReply={true} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate(`/profile/${p.author.username}`)}
        >
          <Avatar seed={authorName} name={authorName} src={p.author.avatarUrl || undefined} className="h-10 w-10" />
          <div>
            <div className="font-semibold text-foreground">{authorName}</div>
            <div className="text-xs text-muted-foreground">{authorRole}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{when}</div>
      </div>
      <div className="mt-3 text-sm text-foreground/90 whitespace-pre-line">{p.content}</div>
      <div className="mt-4 flex items-center justify-between text-sm relative">
        <div className="text-muted-foreground flex items-center gap-3">
          {(p.reactions && Object.values(p.reactions).reduce((a: any, b: any) => a + b, 0) > 0) ? (
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5 z-10">
                {Object.entries(p.reactions)
                  .filter(([_, count]) => (count as number) > 0)
                  .map(([rt, count]) => (
                  <span key={rt} className="bg-card rounded-full shadow-sm border border-border text-[10px] w-[18px] h-[18px] flex items-center justify-center relative z-10" title={`${count} ${rt}`}>
                    {REACTION_EMOJIS[rt]}
                  </span>
                ))}
              </div>
              <span className="text-xs">{String(Object.values(p.reactions).reduce((a: any, b: any) => a + b, 0))}</span>
            </div>
          ) : (
            <span className="text-xs">👍 0</span>
          )}
          <span className="text-xs">💬 {p.stats?.comments || 0}</span>
        </div>
        <div className="flex gap-2 relative">
          <div 
             className="relative flex items-center" 
             onMouseEnter={() => setShowReactions(true)}
             onMouseLeave={() => setShowReactions(false)}
          >
            {showReactions && (
               <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-3 z-50 animate-in fade-in slide-in-from-bottom-2">
                 <div className="bg-background border border-border shadow-lg rounded-[24px] px-3 py-2 flex gap-1.5">
                   {Object.entries(REACTION_EMOJIS).map(([rt, emoji]) => (
                     <button 
                       key={rt} 
                       onClick={() => handleReactionClick(rt)}
                       className="hover:scale-125 transition-transform text-[22px] hover:-translate-y-1"
                       title={rt}
                     >
                       {emoji}
                     </button>
                   ))}
                 </div>
               </div>
            )}
            <button 
              onClick={() => handleReactionClick(p.userReaction || 'like')}
              className={`px-3 py-1.5 rounded-lg border transition-all ${p.userReaction ? 'border-primary/30 bg-primary/10 text-primary font-medium shadow-sm' : 'border-border text-muted-foreground hover:bg-background hover:text-foreground'}`}>
              <span className="flex items-center gap-1.5">
                {p.userReaction ? REACTION_EMOJIS[p.userReaction] : <span className="opacity-70 text-base leading-none translate-y-[-1px]">👍</span>} 
                {p.userReaction ? p.userReaction.charAt(0).toUpperCase() + p.userReaction.slice(1) : 'Like'}
              </span>
            </button>
          </div>
          <button 
             onClick={() => setShowComments(!showComments)}
             className="px-3 py-1.5 rounded-lg border border-border hover:bg-background transition-colors">
            Comment
          </button>
          <button 
            onClick={handleShare}
            className="px-3 py-1.5 rounded-lg border border-border hover:bg-background transition-colors">
            Share
          </button>
        </div>
      </div>
      {showComments && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          {commentsQuery.isLoading ? (
            <div className="text-xs text-muted-foreground">Loading comments...</div>
          ) : nestedComments.length ? (
            <div className="space-y-4">
              {nestedComments.map((c: any) => (
                <CommentNode key={c.id} comment={c} />
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">No comments yet. Be the first!</div>
          )}
          
          {!replyingTo && (
            <div className="flex gap-2 pt-2">
              <input 
                type="text" 
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..." 
                className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commentMutation.mutate({});
                  }
                }}
              />
              <button 
                onClick={() => commentMutation.mutate({})}
                disabled={commentMutation.isPending || !commentText.trim()}
                className="btn-primary text-sm px-4 rounded-lg disabled:opacity-50"
              >
                Post
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useMemo(() => {
    return getAuthUser();
  }, []);

  const name = user?.username || "Member";
  const [filter, setFilter] = useState<FeedFilter>("All");
  const [mobileTab, setMobileTab] = useState<MobileTab>("Feed");
  const [postContent, setPostContent] = useState("");

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!postContent.trim()) return;
      return apiFetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "Post", content: postContent }),
      });
    },
    onSuccess: () => {
      setPostContent("");
      setMobileTab("Feed");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const dashboardQuery = useQuery({
    queryKey: ["dashboard", filter],
    queryFn: async () => {
      const sp = new URLSearchParams({ filter });
      return apiFetch<DashboardResponse>(`/api/dashboard?${sp.toString()}`);
    },
    staleTime: 15_000,
    retry: (count, err) => {
      const status = (err as any)?.status;
      if (status === 401) return false;
      return count < 2;
    },
  });

  const goToFeed = () => {
    setMobileTab("Feed");
    navigate("/dashboard");
  };

  const connectMutation = useMutation({
    mutationFn: async (targetId: number) => {
      return apiFetch("/api/connect", { 
        method: "POST", 
        body: JSON.stringify({ targetId }) 
      });
    },
    onSuccess: () => {
      toast.success("Connection request sent");
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to connect");
    }
  });

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
                      <Avatar 
                        seed={name} 
                        name={name} 
                        src={dashboardQuery.data?.me?.avatarUrl || undefined} 
                        className="h-10 w-10" 
                      />
                      <div>
                        <div className="font-semibold text-foreground">{name}</div>
                        <div className="text-xs text-muted-foreground">{dashboardQuery.data?.me?.membershipTier || "Gold"} Member</div>
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
                  className="bg-transparent text-foreground outline-none text-sm w-64"
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
              <a href={dashboardQuery.data?.me?.username ? `/profile/${dashboardQuery.data.me.username}` : "/profile"} className="text-sm font-medium text-foreground/80 hover:text-foreground">
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
                <div className="flex items-center gap-3">
                  <Avatar 
                    seed={name} 
                    name={name} 
                    src={dashboardQuery.data?.me?.avatarUrl || undefined} 
                    className="h-10 w-10" 
                  />
                  <div>
                    <div className="font-semibold text-foreground">{name}</div>
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
                    {mobileTab === "Post" ? (
                      <div className="mt-4">
                        <textarea
                          value={postContent}
                          onChange={(e) => setPostContent(e.target.value)}
                          className="w-full min-h-[120px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary mb-3"
                          placeholder="What's happening?"
                        />
                        <button
                          onClick={() => postMutation.mutate()}
                          disabled={postMutation.isPending || !postContent.trim()}
                          className="w-full btn-primary text-sm py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Plus className="h-4 w-4" />
                          {postMutation.isPending ? "Posting..." : "Post"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-muted-foreground mt-2">
                          {mobileTab === "Members"
                            ? "Search members and connect."
                            : mobileTab === "Events"
                              ? "Browse upcoming events and RSVP."
                              : "Your member profile (coming next)."}
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
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile: compact create post */}
              <div className="md:hidden rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#1e346b] to-[#d4af37]" />
                  <button
                    type="button"
                    onClick={() => setMobileTab("Post")}
                    className="flex-1 text-left text-sm text-muted-foreground border border-border rounded-full px-4 py-2 bg-background hover:bg-card transition-colors"
                  >
                    What’s happening?
                  </button>
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                  {[
                    { label: "📝", sr: "Post" },
                    { label: "🤝", sr: "Business" },
                    { label: "📅", sr: "Event" },
                    { label: "📸", sr: "Media" },
                  ].map((i) => (
                    <button
                      key={i.sr}
                      type="button"
                      className="h-10 w-16 rounded-xl border border-border bg-background text-base hover:bg-card transition-colors"
                    >
                      <span className="sr-only">{i.sr}</span>
                      {i.label}
                    </button>
                  ))}
                </div>
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
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      className="w-full min-h-[96px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Share an update, a business opportunity, or match plans…"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                      <div className="flex flex-wrap gap-2">
                        {(["Post", "Business", "Event", "Media"] as const).map((t) => (
                          <button
                            key={t}
                            className="px-3 py-1.5 rounded-full border border-border text-xs font-medium hover:bg-background transition-colors"
                          >
                            {t === "Post" ? "📝 Post" : t === "Business" ? "🤝 Business" : t === "Event" ? "📅 Event" : "📸 Media"}
                          </button>
                        ))}
                      </div>
                      <button 
                        onClick={() => postMutation.mutate()}
                        disabled={postMutation.isPending || !postContent.trim()}
                        className="btn-primary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        {postMutation.isPending ? "Posting..." : "Post"}
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
                  Failed to load dashboard. {(dashboardQuery.error as any)?.message || "Please try again."}
                </div>
              ) : !dashboardQuery.data?.feed?.length ? (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  No posts yet. Be the first to share an update.
                </div>
              ) : (
                dashboardQuery.data.feed.map((p) => (
                  <PostItem key={p.id} p={p} queryClient={queryClient} filter={filter} />
                ))
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
                          <div 
                            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => navigate(`/profile/${m.username}`)}
                          >
                            <Avatar seed={display} name={display} src={m.avatarUrl || undefined} className="h-9 w-9" />
                            <div>
                              <div className="text-sm font-semibold text-foreground">{display}</div>
                              <div className="text-xs text-muted-foreground">{m.role || "Member"}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => connectMutation.mutate(m.id)}
                            disabled={connectMutation.isPending}
                            className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-background transition-colors disabled:opacity-50"
                          >
                            {connectMutation.isPending ? "..." : "Connect"}
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
                    dashboardQuery.data.onlineNow.slice(0, 12).map((n) => (
                      <div
                        key={n.id}
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => navigate(`/profile/${n.username}`)}
                      >
                        <div className="relative">
                          <Avatar
                            seed={n.username}
                            name={n.fullName || n.username}
                            src={n.avatarUrl || undefined}
                            className="h-8 w-8"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground leading-none">{n.fullName || n.username}</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">Active now</span>
                        </div>
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

