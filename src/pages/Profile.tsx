import Header from "@/components/Header";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getAuthUser } from "@/lib/auth";
import { uploadToR2 } from "@/lib/uploads";
import Avatar from "@/components/Avatar";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { MapPin, Briefcase, Trophy, Calendar, Edit3, MessageSquare, Trash2, Mail, User } from "lucide-react";

type Profile = {
  username?: string;
  email?: string;
  fullName: string;
  role: string;
  company: string;
  bio: string;
  industry: string;
  favoriteSports: string;
  businessInterests: string;
  lookingFor: string[];
  badges: string[];
  coverImageUrl: string;
  avatarUrl: string;
  membershipTier: string;
  location: string;
};

type Post = {
  id: number;
  kind: string;
  content: string;
  media_url: string | null;
  media_type: string | null;
  mediaUrls: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
};

function getToken() {
  try { return localStorage.getItem("auth_token") || ""; } catch { return ""; }
}

async function fetchMe() {
  const token = getToken();
  const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load profile");
  return data as { user: { id: number; email: string; username: string }; profile: Profile | null };
}

async function saveProfile(input: Partial<Profile>) {
  const token = getToken();
  const res = await fetch("/api/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to save profile");
  return data;
}

async function fetchPublicProfile(username: string) {
  const token = getToken();
  const res = await fetch(`/api/profile/${username}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load profile");
  return data as { user: { id: number; username: string }; profile: Profile; postCount: number };
}

const inputClass = "w-full bg-card border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground mb-2";
const LOOKING_FOR_OPTIONS = ["Business Partnerships", "Investors", "Clients", "Networking"] as const;
const BADGE_OPTIONS = ["Top Networker", "Event Speaker", "Athlete", "Investor"] as const;

type ProfileTab = "Posts" | "About" | "Events" | "Friends";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { username: urlUsername } = useParams();
  const me = useMemo(() => getAuthUser(), []);
  
  const isOwnProfile = !urlUsername || urlUsername === me?.username;
  const [profileUsername, setProfileUsername] = useState(urlUsername || me?.username || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<null | "avatar" | "cover">(null);
  const [tab, setTab] = useState<ProfileTab>("About");
  const [userId, setUserId] = useState<number | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  const [form, setForm] = useState<Profile>({
    username: "", email: "",
    fullName: "", role: "", company: "", bio: "", industry: "",
    favoriteSports: "", businessInterests: "", lookingFor: [],
    badges: [], coverImageUrl: "", avatarUrl: "", membershipTier: "Gold", location: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (isOwnProfile) {
          const data = await fetchMe();
          if (cancelled) return;
          setUserId(data.user.id);
          setProfileUsername(data.user.username);
          if (data.profile) {
            setForm({
              username: data.user.username,
              email: data.user.email,
              fullName: data.profile.fullName || "",
              role: data.profile.role || "",
              company: data.profile.company || "",
              bio: data.profile.bio || "",
              industry: data.profile.industry || "",
              favoriteSports: data.profile.favoriteSports || "",
              businessInterests: data.profile.businessInterests || "",
              lookingFor: Array.isArray(data.profile.lookingFor) ? data.profile.lookingFor : [],
              badges: Array.isArray(data.profile.badges) ? data.profile.badges : [],
              coverImageUrl: data.profile.coverImageUrl || "",
              avatarUrl: data.profile.avatarUrl || "",
              membershipTier: data.profile.membershipTier || "Gold",
              location: data.profile.location || "",
            });
          } else {
             setForm(f => ({ ...f, username: data.user.username, email: data.user.email }));
          }
        } else {
          const data = await fetchPublicProfile(urlUsername!);
          if (cancelled) return;
          setUserId(data.user.id);
          setProfileUsername(data.user.username);
          setForm({
            username: data.user.username,
            fullName: data.profile.fullName || "",
            role: data.profile.role || "",
            company: data.profile.company || "",
            bio: data.profile.bio || "",
            industry: data.profile.industry || "",
            favoriteSports: data.profile.favoriteSports || "",
            businessInterests: data.profile.businessInterests || "",
            lookingFor: Array.isArray(data.profile.lookingFor) ? data.profile.lookingFor : [],
            badges: Array.isArray(data.profile.badges) ? data.profile.badges : [],
            coverImageUrl: data.profile.coverImageUrl || "",
            avatarUrl: data.profile.avatarUrl || "",
            membershipTier: data.profile.membershipTier || "Gold",
            location: data.profile.location || "",
          });
          setTab("Posts"); // Default to posts for public view
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [urlUsername, isOwnProfile]);

  // Load posts when Posts tab selected and userId is known
  useEffect(() => {
    if (tab === "Posts" && userId) {
      setPostsLoading(true);
      apiFetch<{ posts: Post[] }>(`/api/users/${userId}/posts`)
        .then((d) => setPosts(d.posts || []))
        .catch(() => toast.error("Failed to load posts"))
        .finally(() => setPostsLoading(false));
    } else if (tab === "Friends" && userId) {
      setFriendsLoading(true);
      apiFetch<{ friends: any[] }>("/api/friends")
        .then((d) => setFriends(d.friends || []))
        .catch(() => toast.error("Failed to load friends"))
        .finally(() => setFriendsLoading(false));
    }
  }, [tab, userId]);

  const onChange = (k: keyof Profile) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const toggleListValue = (k: "lookingFor" | "badges", value: string) => () =>
    setForm((p) => {
      const set = new Set(p[k]);
      if (set.has(value)) set.delete(value); else set.add(value);
      return { ...p, [k]: Array.from(set) };
    });

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProfile(form);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const onUpload = (kind: "avatar" | "cover") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadToR2(file, kind);
      setForm((p) => ({ ...p, ...(kind === "avatar" ? { avatarUrl: url } : { coverImageUrl: url }) }));
      await saveProfile(kind === "avatar" ? { avatarUrl: url } : { coverImageUrl: url });
      toast.success(kind === "avatar" ? "Avatar updated" : "Cover updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const TIER_COLORS: Record<string, string> = {
    Gold: "bg-amber-100 text-amber-900 border-amber-200",
    Elite: "bg-slate-800 text-white border-slate-700",
    "Founding Member": "bg-gradient-to-r from-[#1e346b] to-[#d4af37] text-white border-transparent",
  };
  const tierClass = TIER_COLORS[form.membershipTier] || TIER_COLORS.Gold;

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-12">
        {/* ── Cover + Avatar ─────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden mt-6">
          {/* Cover image */}
          <div className="relative h-36 sm:h-56 bg-gradient-to-br from-[#1e346b] via-[#2a4a8a] to-[#d4af37]">
            {form.coverImageUrl && (
              <img src={form.coverImageUrl} alt="Cover" className="absolute inset-0 h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
            <label className="absolute top-3 right-3 inline-flex items-center gap-2 rounded-lg border border-white/30 bg-black/40 backdrop-blur px-3 py-1.5 text-xs font-semibold text-white cursor-pointer hover:bg-black/60 transition-colors">
              <Edit3 className="h-3 w-3" />
              <input type="file" accept="image/*" className="hidden" onChange={onUpload("cover")} />
              {uploading === "cover" ? "Uploading…" : "Edit cover"}
            </label>
          </div>

          {/* Profile info row */}
          <div className="px-4 sm:px-6 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex items-end gap-4">
                <div className="relative -mt-10 sm:-mt-14 flex-shrink-0">
                  <Avatar
                    seed={profileUsername}
                    src={form.avatarUrl}
                    name={form.fullName || profileUsername}
                    className="h-20 w-20 sm:h-28 sm:w-28 rounded-2xl shadow-lg border-4 border-card"
                  />
                  <label className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer hover:brightness-110 transition-all shadow-md">
                    <Edit3 className="h-3 w-3" />
                    <input type="file" accept="image/*" className="hidden" onChange={onUpload("avatar")} />
                  </label>
                  {uploading === "avatar" && (
                    <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center text-white text-xs">…</div>
                  )}
                </div>
                <div className="pb-1 mt-2 sm:mt-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
                    {form.fullName || profileUsername}
                  </h1>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {form.role || "Member"}{form.company ? ` · ${form.company}` : ""}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tierClass}`}>
                      ⭐ {form.membershipTier} Member
                    </span>
                    {form.location && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />{form.location}
                      </span>
                    )}
                    {form.industry && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Briefcase className="h-3 w-3" />{form.industry}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pb-1">
                {isOwnProfile ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setTab("About")}
                      className="btn-primary text-sm py-2 px-4 shadow-sm inline-flex items-center gap-2"
                    >
                      <Edit3 className="h-4 w-4" /> Edit Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/profile/${profileUsername}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Profile link copied!");
                      }}
                      className="border border-border rounded-lg bg-background px-4 py-2 text-sm font-semibold hover:bg-card transition-colors inline-flex items-center gap-2"
                    >
                      Share Profile
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(`/messages?user=${userId}`)}
                      className="btn-primary px-6 py-2 text-sm font-semibold"
                    >
                      <MessageSquare className="h-4 w-4" /> Message
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!userId) return;
                        apiFetch(`/api/friends/${userId}`, { method: "POST" })
                          .then(() => toast.success("Request sent!"))
                          .catch((e: any) => toast.error(e.message));
                      }}
                      className="border border-border rounded-lg bg-background px-5 py-2 text-sm font-semibold hover:bg-card transition-colors inline-flex items-center gap-2"
                    >
                      Connect
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Bio */}
            {form.bio && (
              <p className="mt-4 text-sm text-foreground/80 leading-relaxed max-w-2xl">{form.bio}</p>
            )}

            {/* Sports tags */}
            {form.favoriteSports && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {form.favoriteSports.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                  <span key={s} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground/70">
                    ⚽ {s}
                  </span>
                ))}
              </div>
            )}

            {/* Badges */}
            {form.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {form.badges.map((b) => (
                  <span key={b} className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                    🏆 {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────────── */}
        <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {(["Posts", "About", "Events", "Friends"] as ProfileTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-full text-sm font-semibold border transition-colors whitespace-nowrap ${
                tab === t ? "bg-slate-900 text-white border-slate-900" : "bg-card text-foreground border-border hover:bg-background"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
            {/* ── Main column ───────────────────────────────── */}
            <div className="space-y-6">
              {/* Posts tab */}
              {tab === "Posts" && (
                <div>
                  {postsLoading ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">Loading posts…</div>
                  ) : posts.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-8 text-center">
                      <div className="text-3xl mb-3">📝</div>
                      <div className="font-semibold text-foreground">No posts yet</div>
                      <p className="text-sm text-muted-foreground mt-1">Share updates from the dashboard to see them here.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {posts.map((p) => {
                        const allMedia = p.mediaUrls.length > 0 ? p.mediaUrls : (p.media_url ? [p.media_url] : []);
                        return (
                          <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <Avatar seed={profileUsername} name={form.fullName || profileUsername} src={form.avatarUrl} className="h-9 w-9 flex-shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-semibold text-sm text-foreground truncate">{form.fullName || profileUsername}</div>
                                  <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
                                </div>
                              </div>
                              {isOwnProfile && (
                                <button
                                  onClick={async () => {
                                    if (!window.confirm("Delete this post?")) return;
                                    try {
                                      await apiFetch(`/api/feed/${p.id}`, { method: "DELETE" });
                                      setPosts(posts.filter(x => x.id !== p.id));
                                      toast.success("Deleted");
                                    } catch (e: any) {
                                      toast.error(e.message);
                                    }
                                  }}
                                  className="p-1 text-muted-foreground hover:text-destructive transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                            {allMedia.length > 0 && (
                              <div className={`mt-3 rounded-lg overflow-hidden grid gap-0.5 ${allMedia.length > 1 ? "grid-cols-2" : ""}`}>
                                {allMedia.slice(0, 4).map((url, idx) => (
                                  <div key={idx} className="bg-muted relative">
                                    {p.media_type?.startsWith("video") ? (
                                      <video src={url} className="w-full object-contain" controls />
                                    ) : (
                                      <img src={url} alt="" className={`w-full object-contain ${allMedia.length === 1 ? "max-h-[400px]" : "h-44"}`} />
                                    )}
                                    {idx === 3 && allMedia.length > 4 && (
                                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xl">+{allMedia.length - 4}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {p.content && <div className="mt-3 text-sm text-foreground/85 whitespace-pre-line">{p.content}</div>}
                            <div className="mt-3 text-xs text-muted-foreground">
                              👍 {p.like_count} · 💬 {p.comment_count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Events tab */}
              {tab === "Events" && (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" /> Events
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Head to the <button onClick={() => navigate("/events")} className="text-primary underline">Events page</button> to RSVP to upcoming events.
                  </p>
                </div>
              )}

              {/* Friends tab */}
              {tab === "Friends" && (
                <div className="space-y-4">
                  {friendsLoading ? (
                    <div className="text-sm text-muted-foreground py-8 text-center">Loading friends…</div>
                  ) : friends.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-8 text-center">
                      <div className="text-3xl mb-3">🤝</div>
                      <div className="font-semibold text-foreground">No friends yet</div>
                      <p className="text-sm text-muted-foreground mt-1">Connect with other members in the Dashboard or Members page.</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {friends.map((f) => {
                        const name = f.full_name || f.username || "Member";
                        const role = f.role || (f.company ? `Member • ${f.company}` : "Member");
                        return (
                          <div key={f.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar seed={name} name={name} src={f.avatar_url || undefined} className="h-12 w-12 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="font-semibold text-sm text-foreground truncate">{name}</div>
                                <div className="text-xs text-muted-foreground truncate">{role}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => navigate(`/messages?user=${f.id}`)}
                              className="p-2 rounded-lg bg-muted text-muted-foreground hover:bg-primary hover:text-white transition-colors flex-shrink-0"
                            >
                              <MessageSquare className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* About / Edit tab */}
              {tab === "About" && (
                <form onSubmit={onSave} className="space-y-6">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between gap-3 mb-6">
                      <div>
                        <div className="font-semibold text-foreground">Profile Details</div>
                        <div className="text-sm text-muted-foreground mt-1">Keep your profile premium and up to date.</div>
                      </div>
                      <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-5">
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Username</label>
                        <div className="relative">
                           <User className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                           <input className={`${inputClass} pl-10`} value={form.username} onChange={(e) => onChange("username")(e.target.value)} placeholder="username" />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Email address</label>
                        <div className="relative">
                           <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                           <input className={`${inputClass} pl-10`} value={form.email} onChange={(e) => onChange("email")(e.target.value)} placeholder="email@example.com" />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Full name</label>
                        <input className={inputClass} value={form.fullName} onChange={(e) => onChange("fullName")(e.target.value)} placeholder="Your name" />
                      </div>
                      <div>
                        <label className={labelClass}>Role</label>
                        <input className={inputClass} value={form.role} onChange={(e) => onChange("role")(e.target.value)} placeholder="Entrepreneur / Investor / Athlete…" />
                      </div>
                      <div>
                        <label className={labelClass}>Company</label>
                        <input className={inputClass} value={form.company} onChange={(e) => onChange("company")(e.target.value)} placeholder="Company (optional)" />
                      </div>
                      <div>
                        <label className={labelClass}>Industry</label>
                        <input className={inputClass} value={form.industry} onChange={(e) => onChange("industry")(e.target.value)} placeholder="Sports tech / Finance / Media…" />
                      </div>
                      <div>
                        <label className={labelClass}>Location</label>
                        <input className={inputClass} value={form.location} onChange={(e) => onChange("location")(e.target.value)} placeholder="London" />
                      </div>
                      <div>
                        <label className={labelClass}>Membership tier</label>
                        <select className={inputClass} value={form.membershipTier} onChange={(e) => onChange("membershipTier")(e.target.value)}>
                          <option value="Gold">Gold</option>
                          <option value="Elite">Elite</option>
                          <option value="Founding Member">Founding Member</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className={labelClass}>Bio</label>
                      <textarea className={`${inputClass} min-h-[110px] resize-none`} value={form.bio} onChange={(e) => onChange("bio")(e.target.value)} placeholder="Who you are + what you're looking for (keep it premium)." />
                    </div>

                    <div className="mt-4 grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Favorite sports</label>
                        <input className={inputClass} value={form.favoriteSports} onChange={(e) => onChange("favoriteSports")(e.target.value)} placeholder="Football, Tennis, Boxing…" />
                      </div>
                      <div>
                        <label className={labelClass}>Business interests</label>
                        <input className={inputClass} value={form.businessInterests} onChange={(e) => onChange("businessInterests")(e.target.value)} placeholder="Investing, partnerships, hiring…" />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="font-semibold text-foreground mb-1">Looking For</div>
                    <div className="text-sm text-muted-foreground mb-4">This makes networking intentional — your secret weapon.</div>
                    <div className="flex flex-wrap gap-2">
                      {LOOKING_FOR_OPTIONS.map((o) => {
                        const selected = form.lookingFor.includes(o);
                        return (
                          <button key={o} type="button" onClick={toggleListValue("lookingFor", o)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${selected ? "bg-slate-900 text-white border-slate-900" : "bg-background text-foreground border-border hover:bg-card"}`}>
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="font-semibold text-foreground mb-1">Badges</div>
                    <div className="text-sm text-muted-foreground mb-4">Add social proof to stand out.</div>
                    <div className="flex flex-wrap gap-2">
                      {BADGE_OPTIONS.map((o) => {
                        const selected = form.badges.includes(o);
                        return (
                          <button key={o} type="button" onClick={toggleListValue("badges", o)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${selected ? "bg-amber-500 text-white border-amber-500" : "bg-background text-foreground border-border hover:bg-card"}`}>
                            🏆 {o}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* ── Right sidebar ─────────────────────────────── */}
            <aside className="space-y-6">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="font-semibold text-foreground mb-4">Account</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Username</span>
                    <span className="font-medium text-foreground">@{profileUsername}</span>
                  </div>
                  {form.email && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span className="font-medium text-foreground truncate max-w-[140px]">{form.email}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tier</span>
                    <span className={`font-semibold text-xs rounded-full px-2.5 py-0.5 border ${tierClass}`}>{form.membershipTier}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="font-semibold text-foreground mb-4">Quick Actions</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Messages", action: () => navigate("/messages") },
                    { label: "Events", action: () => navigate("/events") },
                    { label: "Business Hub", action: () => navigate("/business") },
                    { label: "Leaderboard", action: () => navigate("/leaderboard") },
                  ].map((a) => (
                    <button key={a.label} type="button" onClick={a.action}
                      className="rounded-lg border border-border bg-background py-2 px-2 text-xs font-semibold text-center hover:bg-card transition-colors leading-tight">
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.lookingFor.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="font-semibold text-foreground mb-3">Looking For</div>
                  <div className="flex flex-wrap gap-2">
                    {form.lookingFor.map((lf) => (
                      <span key={lf} className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-800">
                        {lf}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
