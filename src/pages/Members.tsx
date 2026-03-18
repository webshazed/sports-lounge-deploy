import Header from "@/components/Header";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getAuthUser } from "@/lib/auth";
import Avatar from "@/components/Avatar";

type Member = {
  id: number;
  username: string;
  fullName?: string | null;
  role?: string | null;
  company?: string | null;
  industry?: string | null;
  location?: string | null;
  favoriteSports?: string | null;
  membershipTier: string;
  avatarUrl?: string | null;
  lookingFor: string[];
};

function getToken() {
  try {
    return localStorage.getItem("auth_token") || "";
  } catch {
    return "";
  }
}

async function fetchMembers(params: {
  q?: string;
  industry?: string;
  location?: string;
  sport?: string;
  lookingFor?: string;
}) {
  const token = getToken();
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.industry) sp.set("industry", params.industry);
  if (params.location) sp.set("location", params.location);
  if (params.sport) sp.set("sport", params.sport);
  if (params.lookingFor) sp.set("lookingFor", params.lookingFor);

  const res = await fetch(`/api/members?${sp.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load members");
  return data as { members: Member[] };
}

const LOOKING_FOR_OPTIONS = ["Business Partnerships", "Investors", "Clients", "Networking"] as const;

const Members = () => {
  const navigate = useNavigate();
  const me = useMemo(() => getAuthUser(), []);
  const displayName = me?.username || "Member";

  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [sport, setSport] = useState("");
  const [lookingFor, setLookingFor] = useState("");

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await fetchMembers({ q, industry, location, sport, lookingFor });
        if (!cancelled) setMembers(result.members);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Failed to load members");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, industry, location, sport, lookingFor]);

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-2xl sm:text-3xl font-semibold">Members Network</div>
            <div className="text-sm text-muted-foreground mt-1">
              Discover members intentionally — shared sports, business, and events.
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Signed in as {displayName}</div>
        </div>

        {/* Search & filters */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              className="md:col-span-2 w-full border border-border rounded-lg bg-background px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Search by name or username…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <input
              className="w-full border border-border rounded-lg bg-background px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
            <input
              className="w-full border border-border rounded-lg bg-background px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <input
              className="w-full border border-border rounded-lg bg-background px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Sport interest"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Looking for</span>
            <button
              type="button"
              onClick={() => setLookingFor("")}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                lookingFor === "" ? "bg-slate-900 text-white border-slate-900" : "bg-background border-border hover:bg-card"
              }`}
            >
              All
            </button>
            {LOOKING_FOR_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setLookingFor(lookingFor === o ? "" : o)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  lookingFor === o ? "bg-slate-900 text-white border-slate-900" : "bg-background border-border hover:bg-card"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Smart suggestions (MVP placeholder) */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="font-semibold text-foreground">People you should meet</div>
          <div className="text-sm text-muted-foreground mt-1">
            Coming next: smart suggestions based on shared interests + events + mutuals.
          </div>
        </div>

        {/* Member cards */}
        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading members…</div>
          ) : members.length === 0 ? (
            <div className="text-sm text-muted-foreground">No members found. Try widening your filters.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((m) => (
                <div key={m.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div 
                      className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/profile/${m.username}`)}
                    >
                      <Avatar
                        seed={m.username}
                        src={m.avatarUrl}
                        name={m.fullName || m.username}
                        className="h-12 w-12 rounded-2xl"
                      />
                      <div>
                        <div className="font-semibold text-foreground">{m.fullName || m.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {[m.role, m.company].filter(Boolean).join(" • ") || "Member"}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold rounded-full border border-border bg-background px-3 py-1">
                      {m.membershipTier} Member
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    {m.favoriteSports ? (
                      <span>⚽ {m.favoriteSports.split(",")[0].trim()}</span>
                    ) : null}
                    {m.location ? <span>📍 {m.location}</span> : null}
                    {m.industry ? <span>💼 {m.industry}</span> : null}
                  </div>

                  {m.lookingFor?.length ? (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Looking for:{" "}
                      <span className="text-foreground font-medium">{m.lookingFor.slice(0, 2).join(", ")}</span>
                    </div>
                  ) : null}

                  <div className="mt-4 flex gap-2">
                    <button 
                      type="button" 
                      className="btn-primary text-sm py-2 px-4 flex-1"
                      onClick={() => navigate(`/profile/${m.username}`)}
                    >
                      View Profile
                    </button>
                    <button
                      type="button"
                      className="flex-1 border border-border rounded-md bg-background px-4 py-2 text-sm font-semibold hover:bg-card transition-colors"
                      onClick={() => navigate(`/messages?user=${m.id}`)}
                    >
                      Message
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Members;

