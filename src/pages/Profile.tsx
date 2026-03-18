import Header from "@/components/Header";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { getAuthUser, updateAuthUser } from "@/lib/auth";
import { uploadToR2 } from "@/lib/uploads";
import Avatar from "@/components/Avatar";
import { 
  MapPin, 
  Briefcase, 
  Building2, 
  Globe, 
  Phone, 
  Mail, 
  Calendar, 
  User, 
  Trophy,
  ExternalLink,
  ChevronRight,
  Pencil,
  Plus,
  UserPlus,
  UserCheck,
  MessageSquare,
  Clock,
  X
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  phone: string;
  dob: string;
  gender: string;
  aboutYou: string;
  plTeam?: string;
  worldTeam?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  bizType?: string;
  bizName?: string;
  regType?: string;
  privacySettings: Record<string, "all_members" | "friends" | "only_me">;
};

function getToken() {
  try {
    return localStorage.getItem("auth_token") || "";
  } catch {
    return "";
  }
}

async function fetchMe() {
  const token = getToken();
  const res = await fetch("/api/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load profile");
  return data as { user: { id: number; email: string; username: string } | null; profile: any | null };
}

async function fetchProfile(username: string) {
  const token = getToken();
  const res = await fetch(`/api/profile/${username}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load profile");
  return data as { user: null; profile: any };
}

async function saveProfile(input: Partial<Profile>) {
  const token = getToken();
  const res = await fetch("/api/me", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to save profile");
  return data as { profile: any };
}

const inputClass =
  "w-full bg-card border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground mb-2";

const LOOKING_FOR_OPTIONS = ["Business Partnerships", "Investors", "Clients", "Networking"] as const;
const BADGE_OPTIONS = ["Top Networker", "Event Speaker", "Athlete", "Investor"] as const;

const SectionCard = ({ title, icon: Icon, children, className = "" }: { title: string; icon: any; children: React.ReactNode; className?: string }) => (
  <div className={`rounded-2xl border border-border bg-card shadow-sm overflow-hidden ${className}`}>
    <div className="border-b border-border bg-muted/30 px-6 py-4 flex items-center gap-2.5">
      <Icon className="h-5 w-5 text-[#1e346b]" />
      <h3 className="font-bold font-body text-foreground tracking-tight">{title}</h3>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const InfoItem = ({ label, value, icon: Icon }: { label: string; value?: string | null; icon?: any }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40 last:border-0">
      {Icon && <Icon className="h-4 w-4 mt-0.5 text-[#1e346b]/70" />}
      <div>
        <div className="text-[11px] font-body font-bold uppercase tracking-wider text-muted-foreground/50 mb-0.5">{label}</div>
        <div className="text-sm font-medium text-foreground/90">{value}</div>
      </div>
    </div>
  );
};

type ProfileTab = "Posts" | "About" | "Events";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { username } = useParams();
  const user = useMemo(() => getAuthUser(), []);
  const isOwnProfile = !username || username.toLowerCase() === user?.username?.toLowerCase();
  const displayName = username || user?.username || "Member";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState<null | "avatar" | "cover">(null);
  const [tab, setTab] = useState<ProfileTab>("About");
  const [connStatus, setConnStatus] = useState<"none" | "pending_in" | "pending_out" | "connected">("none");
  const [targetUserId, setTargetUserId] = useState<number | null>(null);
  const [form, setForm] = useState<Profile>({
    fullName: "",
    role: "",
    company: "",
    bio: "",
    industry: "",
    favoriteSports: "",
    businessInterests: "",
    lookingFor: [],
    badges: [],
    coverImageUrl: "",
    avatarUrl: "",
    membershipTier: "Gold",
    location: "",
    phone: "",
    dob: "",
    gender: "",
    aboutYou: "",
    privacySettings: {
      phone: "only_me",
      email: "only_me",
      dob: "only_me",
      username: "only_me"
    }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = isOwnProfile ? await fetchMe() : await fetchProfile(username!);
        if (cancelled) return;
        
        const u = data.user;
        const p = data.profile;
          if (p || u) {
            const uid = u?.id || p?.userId;
            setTargetUserId(uid ? Number(uid) : null);
            setForm({
            username: u?.username || p?.username || "",
            email: u?.email || p?.email || "",
            fullName: p?.fullName || "",
            role: p?.role || "",
            company: p?.company || "",
            bio: p?.bio || "",
            industry: p?.industry || "",
            favoriteSports: p?.favoriteSports || "",
            businessInterests: p?.businessInterests || "",
            lookingFor: Array.isArray(p?.lookingFor) ? p.lookingFor : [],
            badges: Array.isArray(p?.badges) ? p.badges : [],
            coverImageUrl: p?.coverImageUrl || "",
            avatarUrl: p?.avatarUrl || "",
            membershipTier: p?.membershipTier || "Gold",
            location: p?.location || "",
            phone: p?.phone || "",
            dob: p?.dob || "",
            gender: p?.gender || "",
            aboutYou: p?.aboutYou || "",
            plTeam: p?.plTeam || "",
            worldTeam: p?.worldTeam || "",
            addressLine1: p?.addressLine1 || "",
            addressLine2: p?.addressLine2 || "",
            city: p?.city || "",
            zipCode: p?.zipCode || "",
            country: p?.country || "",
            bizType: p?.bizType || "",
            bizName: p?.bizName || "",
            regType: p?.regType || "",
            privacySettings: p?.privacySettings || {}
          });
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Fetch connection status if not own profile
    if (!isOwnProfile && username && targetUserId) {
      (async () => {
        try {
          const res = await apiFetch<{ connections: any[], pendingIncoming: any[], pendingOutgoing: any[] }>("/api/connect");
          if (cancelled) return;
          
          const isMsg = res.connections.some(c => Number(c.id) === targetUserId);
          const isPendingIn = res.pendingIncoming.some(c => Number(c.id) === targetUserId);
          const isPendingOut = res.pendingOutgoing.some(c => Number(c.id) === targetUserId);

          if (isMsg) setConnStatus("connected");
          else if (isPendingIn) setConnStatus("pending_in");
          else if (isPendingOut) setConnStatus("pending_out");
          else setConnStatus("none");
        } catch (e) {
          // silent
        }
      })();
    }
  }, [username, isOwnProfile, targetUserId]);

  const queryClient = useQueryClient();

  const suggestedQuery = useQuery({
    queryKey: ["members-suggested", user?.id],
    queryFn: async () => {
      const data = await apiFetch<{ members: any[] }>("/api/members?limit=3");
      return data.members.filter(m => m.username !== username);
    },
    enabled: !!user?.id
  });

  const sidebarConnectMutation = useMutation({
    mutationFn: async (targetId: number) => {
      return apiFetch("/api/connect", { 
        method: "POST", 
        body: JSON.stringify({ targetId }) 
      });
    },
    onSuccess: () => {
      toast.success("Connection request sent");
      queryClient.invalidateQueries({ queryKey: ["members-suggested"] });
      // Also potentially invalidate profile query to update the main button
      queryClient.invalidateQueries({ queryKey: ["profile", username] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to connect");
    }
  });

  const onConnectAction = async () => {
    if (!targetUserId) return;
    try {
      if (connStatus === "none") {
        await apiFetch("/api/connect", { method: "POST", body: JSON.stringify({ targetId: targetUserId }) });
        setConnStatus("pending_out");
        toast.success("Connection request sent");
      } else if (connStatus === "pending_in") {
        await apiFetch("/api/connect", { method: "PUT", body: JSON.stringify({ requesterId: targetUserId }) });
        setConnStatus("connected");
        toast.success("Connection accepted");
      } else if (connStatus === "pending_out" || connStatus === "connected") {
        await apiFetch("/api/connect", { method: "DELETE", body: JSON.stringify({ targetId: targetUserId }) });
        setConnStatus("none");
        toast.info(connStatus === "connected" ? "Connection removed" : "Request cancelled");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const onChange = (k: keyof Profile) => (v: string) => setForm((p) => ({ ...p, [k]: v }));
  const toggleListValue =
    (k: "lookingFor" | "badges", value: string) =>
    () =>
      setForm((p) => {
        const set = new Set(p[k]);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        return { ...p, [k]: Array.from(set) };
      });

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveProfile(form);
      updateAuthUser({ fullName: form.fullName, avatarUrl: form.avatarUrl });
      toast.success("Profile updated");
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const onUpload =
    (kind: "avatar" | "cover") =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setUploading(kind);
      try {
        const url = await uploadToR2(file, kind);
        setForm((p) => ({
          ...p,
          ...(kind === "avatar" ? { avatarUrl: url } : { coverImageUrl: url }),
        }));
        await saveProfile(kind === "avatar" ? { avatarUrl: url } : { coverImageUrl: url });
        if (kind === "avatar") updateAuthUser({ avatarUrl: url });
        toast.success(kind === "avatar" ? "Avatar updated" : "Cover updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(null);
      }
    };

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Header / first impression */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="relative h-40 sm:h-56 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200">
            {form.coverImageUrl ? (
              <img
                src={form.coverImageUrl}
                alt="Cover"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
            {isOwnProfile && (
              <div className="absolute top-3 right-3 flex gap-2">
                <label className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 backdrop-blur-md px-4 py-2 text-xs font-bold text-white cursor-pointer hover:bg-black/60 transition-all shadow-lg group">
                  <input type="file" accept="image/*" className="hidden" onChange={onUpload("cover")} />
                  {uploading === "cover" ? "..." : <Plus className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform" />}
                  {uploading === "cover" ? "Uploading..." : "Cover"}
                </label>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                <div className="relative group/avatar">
                  <Avatar
                    seed={displayName}
                    src={form.avatarUrl}
                    name={form.fullName || displayName}
                    className="-mt-12 sm:-mt-16 h-20 w-20 sm:h-28 sm:w-28 rounded-2xl shadow-md border-4 border-card ring-1 ring-border/50 bg-card"
                  />
                  {isOwnProfile && (
                    <label className="absolute inset-0 -mt-12 sm:-mt-16 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover/avatar:opacity-100 cursor-pointer transition-opacity">
                      <input type="file" accept="image/*" className="hidden" onChange={onUpload("avatar")} />
                      <Pencil className="h-6 w-6 text-white" />
                    </label>
                  )}
                  {uploading === "avatar" && (
                    <div className="absolute inset-0 -mt-12 sm:-mt-16 flex items-center justify-center bg-card/80 rounded-2xl">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent animate-spin rounded-full" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {form.fullName || displayName}
                  </div>
                  <div className="text-base sm:text-lg font-medium text-muted-foreground mt-0.5">
                    {form.role || "Member"} {form.company && <span className="text-muted-foreground/60 font-normal">at {form.company}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5 opacity-80">
                      <MapPin className="h-4 w-4" /> {form.location || form.city || "Global"}
                    </span>
                    <span className="flex items-center gap-1.5 opacity-80">
                      <Briefcase className="h-4 w-4" /> {form.industry || "General"}
                    </span>
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
                      {form.membershipTier}
                    </span>
                  </div>
                </div>
              </div>

              {isOwnProfile && (
                <button 
                  onClick={() => {
                    setIsEditing(!isEditing);
                    setTab("About"); // Switch to About when editing
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isEditing 
                      ? "bg-muted text-foreground hover:bg-muted/80" 
                      : "bg-primary text-primary-foreground hover:shadow-lg hover:-translate-y-0.5"
                  }`}
                >
                  <Pencil className="h-4 w-4" />
                  {isEditing ? "View Profile" : "Edit Profile"}
                </button>
              )}
              {!isOwnProfile && (
                <div className="flex gap-2">
                   <button 
                    onClick={() => navigate(`/messages?user=${targetUserId}`)}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-background border border-border text-sm font-semibold hover:bg-muted transition-all shadow-sm"
                  >
                    <MessageSquare className="h-4 w-4" /> Message
                  </button>
                  <button 
                    onClick={onConnectAction}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-md ${
                      connStatus === 'none' 
                        ? 'btn-primary' 
                        : 'bg-muted text-muted-foreground border border-border hover:bg-card'
                    }`}
                  >
                    {connStatus === 'none' && <UserPlus className="h-4 w-4" />}
                    {connStatus === 'pending_out' && <Clock className="h-4 w-4" />}
                    {connStatus === 'pending_in' && <UserCheck className="h-4 w-4" />}
                    {connStatus === 'connected' && <UserCheck className="h-4 w-4" />}
                    
                    {connStatus === 'none' && "Connect"}
                    {connStatus === 'pending_out' && "Pending"}
                    {connStatus === 'pending_in' && "Accept Request"}
                    {connStatus === 'connected' && "Connected"}
                  </button>
                </div>
              )}
              {(form.badges || []).map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center rounded-full border border-border bg-background/50 px-3 py-1 text-xs font-semibold text-muted-foreground"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar">
          {(["Posts", "About", "Events"] as ProfileTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
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
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Main column */}
            <div className="space-y-6">
              {tab === "Posts" && (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="font-semibold text-foreground">Posts / Activity</div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Coming next: posts, business posts, event recaps, media tabs.
                  </div>
                </div>
              )}

              {tab === "Events" && (
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="font-semibold text-foreground">Events</div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Coming next: attended events + upcoming RSVPs with guest list.
                  </div>
                </div>
              )}

              {tab === "About" && !isEditing && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  <SectionCard title="About" icon={User}>
                    <div className="text-base text-foreground/80 leading-relaxed whitespace-pre-line">
                      {form.bio || "No bio provided."}
                    </div>
                    {form.aboutYou && (
                      <div className="mt-6 pt-6 border-t border-border/50">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Additional Details</h4>
                        <p className="text-sm text-foreground/70">{form.aboutYou}</p>
                      </div>
                    )}
                  </SectionCard>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <SectionCard title="Professional" icon={Briefcase}>
                      <div className="space-y-1">
                        <InfoItem label="Role" value={form.role || "Member"} icon={User} />
                        <InfoItem label="Company" value={form.company} icon={Building2} />
                        <InfoItem label="Industry" value={form.industry} icon={Globe} />
                        <InfoItem label="Interests" value={form.businessInterests} icon={ChevronRight} />
                      </div>
                    </SectionCard>

                    <SectionCard title="Personal & Contact" icon={Mail}>
                      <div className="space-y-1">
                        <InfoItem label="Location" value={form.location || form.city} icon={MapPin} />
                        <InfoItem label="Country" value={form.country} icon={Globe} />
                        <InfoItem label="Email" value={form.email || (isOwnProfile ? "" : "Private")} icon={Mail} />
                        <InfoItem label="Phone" value={form.phone || (isOwnProfile ? "" : "Private")} icon={Phone} />
                        <InfoItem label="Birthday" value={form.dob} icon={Calendar} />
                      </div>
                    </SectionCard>
                  </div>

                  <SectionCard title="Sports & Teams" icon={Trophy}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Interests</h4>
                        <div className="flex flex-wrap gap-2">
                          {form.favoriteSports.split(",").map(s => s.trim()).filter(Boolean).map(s => (
                            <span key={s} className="bg-background border border-border px-3 py-1 rounded-full text-xs font-semibold shadow-sm italic capitalize">
                              {s}
                            </span>
                          ))}
                          {!form.favoriteSports && <span className="text-xs text-muted-foreground">No sports listed</span>}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Premier League</h4>
                          <div className="text-sm font-bold text-foreground flex items-center gap-2 italic">
                            <Trophy className="h-3.5 w-3.5 text-amber-500" /> {form.plTeam || "None selected"}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">World Football</h4>
                          <div className="text-sm font-bold text-foreground flex items-center gap-2 italic">
                            <Globe className="h-3.5 w-3.5 text-blue-500" /> {form.worldTeam || "None selected"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              )}

              {tab === "About" && isEditing && (
                <form onSubmit={onSave} className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                  <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
                    <div className="flex items-center justify-between gap-3 border-b border-border pb-6 mb-6">
                      <div>
                        <div className="font-bold text-xl text-foreground">Edit Profile</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Update your professional and personal details.
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          type="button" 
                          onClick={() => setIsEditing(false)}
                          className="px-4 py-2 border border-border rounded-lg text-sm font-semibold hover:bg-muted/50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-6 shadow-md hover:shadow-lg transition-all">
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Full name</label>
                        <input
                          className={inputClass}
                          value={form.fullName}
                          onChange={(e) => onChange("fullName")(e.target.value)}
                          placeholder="Your name"
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Role</label>
                        <input
                          className={inputClass}
                          value={form.role}
                          onChange={(e) => onChange("role")(e.target.value)}
                          placeholder="Entrepreneur / Investor / Athlete…"
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Company</label>
                        <input
                          className={inputClass}
                          value={form.company}
                          onChange={(e) => onChange("company")(e.target.value)}
                          placeholder="Company (optional)"
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Industry</label>
                        <input
                          className={inputClass}
                          value={form.industry}
                          onChange={(e) => onChange("industry")(e.target.value)}
                          placeholder="Sports tech / Finance / Media…"
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Location (City)</label>
                        <input
                          className={inputClass}
                          value={form.location || form.city}
                          onChange={(e) => onChange("location")(e.target.value)}
                          placeholder="London"
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Country</label>
                        <input
                          className={inputClass}
                          value={form.country}
                          onChange={(e) => onChange("country")(e.target.value)}
                          placeholder="United Kingdom"
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Premier League Team</label>
                        <input
                          className={inputClass}
                          value={form.plTeam}
                          onChange={(e) => onChange("plTeam")(e.target.value)}
                          placeholder="Arsenal, Liverpool, etc."
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>World Football Team</label>
                        <input
                          className={inputClass}
                          value={form.worldTeam}
                          onChange={(e) => onChange("worldTeam")(e.target.value)}
                          placeholder="Real Madrid, FC Bayern, etc."
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Membership tier</label>
                        <select
                          className={inputClass}
                          value={form.membershipTier}
                          onChange={(e) => onChange("membershipTier")(e.target.value)}
                          disabled={!isOwnProfile}
                        >
                          <option value="Gold">Gold</option>
                          <option value="Elite">Elite</option>
                          <option value="Founding">Founding Member</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Username</label>
                        <input
                          className={inputClass}
                          value={form.username || (isOwnProfile ? "" : "Private")}
                          disabled
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Email</label>
                        <input
                          className={inputClass}
                          value={form.email || (isOwnProfile ? "" : "Private")}
                          disabled
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className={labelClass}>Bio</label>
                      <textarea
                        className={`${inputClass} min-h-[110px] resize-none`}
                        value={form.bio}
                        onChange={(e) => onChange("bio")(e.target.value)}
                        placeholder="Who you are + what you’re looking for (keep it premium)."
                        disabled={!isOwnProfile}
                      />
                    </div>

                    <div className="mt-4 grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Favorite sports</label>
                        <input
                          className={inputClass}
                          value={form.favoriteSports}
                          onChange={(e) => onChange("favoriteSports")(e.target.value)}
                          placeholder="Football, Tennis, Boxing…"
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Business interests</label>
                        <input
                          className={inputClass}
                          value={form.businessInterests}
                          onChange={(e) => onChange("businessInterests")(e.target.value)}
                          placeholder="Investing, partnerships, hiring…"
                          disabled={!isOwnProfile}
                        />
                      </div>
                    </div>
                    <div className="mt-4 grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Phone</label>
                        <input
                          className={inputClass}
                          value={form.phone || (isOwnProfile ? "" : "Private")}
                          onChange={(e) => onChange("phone")(e.target.value)}
                          placeholder="+1 234 567 890"
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Date of Birth</label>
                        <input
                          type="date"
                          className={inputClass}
                          value={form.dob || ""}
                          onChange={(e) => onChange("dob")(e.target.value)}
                          disabled={!isOwnProfile}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Gender</label>
                        <select
                          className={inputClass}
                          value={form.gender}
                          onChange={(e) => onChange("gender")(e.target.value)}
                          disabled={!isOwnProfile}
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other / Prefer not to say</option>
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>About You</label>
                        <input
                          className={inputClass}
                          value={form.aboutYou}
                          onChange={(e) => onChange("aboutYou")(e.target.value)}
                          placeholder="A bit more about you..."
                          disabled={!isOwnProfile}
                        />
                      </div>
                    </div>
                    
                    {isOwnProfile && (
                      <div className="mt-8 border-t border-border pt-8">
                        <div className="font-semibold text-foreground">Privacy Settings</div>
                        <p className="text-sm text-muted-foreground mt-1 mb-4">
                          Control who can see your personal information.
                        </p>
                        <div className="space-y-4">
                          {["Username", "Email", "Phone", "DOB"].map((field) => {
                            const key = field.toLowerCase();
                            return (
                              <div key={field} className="flex items-center justify-between gap-4">
                                <label className="text-sm font-medium">{field} Visibility</label>
                                <select 
                                  className={`${inputClass} max-w-[180px] py-2`}
                                  value={form.privacySettings[key] || "only_me"}
                                  onChange={(e) => setForm(p => ({
                                    ...p,
                                    privacySettings: {
                                      ...p.privacySettings,
                                      [key]: e.target.value as any
                                    }
                                  }))}
                                >
                                  <option value="all_members">All Members</option>
                                  <option value="friends">Only Friends</option>
                                  <option value="only_me">Only Me</option>
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="font-semibold text-foreground">Looking For</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      This makes networking intentional (your secret weapon).
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {LOOKING_FOR_OPTIONS.map((o) => {
                        const selected = form.lookingFor.includes(o);
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={toggleListValue("lookingFor", o)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                              selected
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-background text-foreground border-border hover:bg-card"
                            }`}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="font-semibold text-foreground">Badges</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Add social proof (top networker, speaker, athlete, investor).
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {BADGE_OPTIONS.map((o) => {
                        const selected = form.badges.includes(o);
                        return (
                          <button
                            key={o}
                            type="button"
                            onClick={toggleListValue("badges", o)}
                            className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                              selected
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-background text-foreground border-border hover:bg-card"
                            }`}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </form>
              )}

            </div>

            {/* Right column (quick panel) */}
            <aside className="space-y-6">
              {!isOwnProfile && (
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <div className="font-semibold text-foreground">Quick Actions</div>
                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <button
                      onClick={() => navigate(`/messages?user=${targetUserId}`)}
                      className="flex items-center justify-center gap-2 w-full rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-muted transition-all"
                    >
                      <MessageSquare className="h-4 w-4 text-primary" /> Send Message
                    </button>
                    <button
                      onClick={onConnectAction}
                      className="flex items-center justify-center gap-2 w-full rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-muted transition-all"
                    >
                      {connStatus === 'none' && <UserPlus className="h-4 w-4 text-primary" />}
                      {connStatus === 'pending_out' && <Clock className="h-4 w-4 text-amber-500" />}
                      {connStatus === 'pending_in' && <UserCheck className="h-4 w-4 text-emerald-500" />}
                      {connStatus === 'connected' && <UserCheck className="h-4 w-4 text-emerald-500" />}
                      
                      {connStatus === 'none' && "Connect"}
                      {connStatus === 'pending_out' && "Request Sent"}
                      {connStatus === 'pending_in' && "Accept Connect"}
                      {connStatus === 'connected' && "Remove Connection"}
                    </button>
                    <button
                      className="flex items-center justify-center gap-2 w-full rounded-lg border border-border bg-background py-2.5 text-sm font-semibold hover:bg-muted transition-all opacity-50 cursor-not-allowed"
                    >
                      Invite to Event
                    </button>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="font-semibold text-foreground mb-4">People You May Know</div>
                <div className="space-y-4">
                  {suggestedQuery.isLoading ? (
                    <div className="text-sm text-muted-foreground italic">Finding members...</div>
                  ) : suggestedQuery.data?.length ? (
                    suggestedQuery.data.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between gap-3">
                        <div 
                          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => navigate(`/profile/${m.username}`)}
                        >
                          <Avatar seed={m.username} src={m.avatarUrl} className="h-9 w-9" />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900 leading-none">{m.fullName || m.username}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{m.role || "Member"}</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            sidebarConnectMutation.mutate(m.id);
                          }}
                          disabled={sidebarConnectMutation.isPending}
                          className="px-2 py-1 rounded-md border border-primary/20 text-[10px] font-bold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                        >
                          {sidebarConnectMutation.isPending ? "..." : "Connect"}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No suggestions available.</div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="font-semibold text-foreground">Lounge Activity</div>
                <div className="text-sm text-muted-foreground mt-2">
                  Coming next: check-ins, who’s at the lounge, favorite nights.
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

