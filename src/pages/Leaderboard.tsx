import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";

type Leader = {
  rank: number;
  id: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  membershipTier: string;
  role: string | null;
  company: string | null;
  postCount: number;
  likeCount: number;
  eventCount: number;
  score: number;
};

const RANK_STYLES = [
  "from-amber-400 to-yellow-300 text-amber-900",
  "from-slate-300 to-slate-200 text-slate-700",
  "from-orange-400 to-amber-300 text-orange-900",
];

const MEDAL = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => apiFetch<{ members: Leader[] }>("/api/leaderboard"),
    staleTime: 60_000,
  });

  const members = data?.members || [];
  const top3 = members.slice(0, 3);
  const rest = members.slice(3);

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 p-6 mb-8 text-white">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Leaderboard</h1>
              <p className="text-white/80 text-sm mt-1">Top members ranked by posts, likes &amp; events</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading rankings…</div>
        ) : members.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Trophy className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="font-semibold text-foreground">No rankings yet</div>
            <p className="text-sm text-muted-foreground mt-1">Start posting, liking, and attending events to climb the board!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top 3 podium cards */}
            {top3.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {[top3[1], top3[0], top3[2]].filter(Boolean).map((m, idx) => {
                  const podiumIdx = m?.rank === 1 ? 0 : m?.rank === 2 ? 1 : 2;
                  if (!m) return null;
                  const display = m.fullName || m.username;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-2xl p-4 flex flex-col items-center gap-2 bg-gradient-to-b ${RANK_STYLES[podiumIdx]} ${podiumIdx === 0 ? "ring-2 ring-amber-400 scale-105 shadow-lg" : ""}`}
                    >
                      <div className="text-2xl">{MEDAL[podiumIdx]}</div>
                      <Avatar seed={display} name={display} src={m.avatarUrl || undefined} className="h-12 w-12 sm:h-14 sm:w-14" />
                      <div className="text-center">
                        <div className="font-bold text-xs leading-tight">{display}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{m.score} pts</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Score key */}
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2">How scores work</div>
              <div className="flex flex-wrap gap-4 text-xs text-foreground/80">
                <span>📝 Post = 3 pts</span>
                <span>👍 Like received = 2 pts</span>
                <span>📅 Event RSVP = 5 pts</span>
              </div>
            </div>

            {/* Full table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto] px-4 py-2 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span className="w-8">Rank</span>
                <span>Member</span>
                <span>Score</span>
              </div>
              {members.map((m) => {
                const display = m.fullName || m.username;
                const medal = m.rank <= 3 ? MEDAL[m.rank - 1] : null;
                return (
                  <div
                    key={m.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <div className="w-8 text-center">
                      {medal ? (
                        <span className="text-lg">{medal}</span>
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">#{m.rank}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar seed={display} name={display} src={m.avatarUrl || undefined} className="h-9 w-9 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-foreground truncate">{display}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {m.role || m.membershipTier + " Member"}
                          {m.company ? ` • ${m.company}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-foreground">{m.score}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {m.postCount}p · {m.likeCount}l · {m.eventCount}e
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
