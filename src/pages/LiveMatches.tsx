import { useState } from "react";
import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tv2, Clock, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Match = {
  id: number;
  title: string;
  sport: string;
  team_home: string;
  team_away: string;
  score_home: number;
  score_away: number;
  status: "live" | "upcoming" | "finished";
  starts_at: string;
  venue: string | null;
  watch_party_count: number;
  my_rsvp: number;
};

const SPORT_EMOJI: Record<string, string> = {
  Football: "⚽", Tennis: "🎾", Cricket: "🏏", Basketball: "🏀", default: "🏆",
};

const statusConfig = {
  live: { label: "LIVE", class: "bg-red-500 text-white" },
  upcoming: { label: "UPCOMING", class: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" },
  finished: { label: "FT", class: "bg-muted text-muted-foreground" },
};

export default function LiveMatches() {
  const qc = useQueryClient();
  const [rsvping, setRsvping] = useState<number | null>(null);
  const [filter, setFilter] = useState("All");

  const { data, isLoading } = useQuery({
    queryKey: ["live-matches"],
    queryFn: () => apiFetch<{ matches: Match[] }>("/api/live-matches"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const sports = ["All", ...Array.from(new Set((data?.matches || []).map((m) => m.sport)))];
  const matches = (data?.matches || []).filter((m) => filter === "All" || m.sport === filter);

  const handleRsvp = async (matchId: number) => {
    setRsvping(matchId);
    try {
      await apiFetch(`/api/live-matches/${matchId}/rsvp`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["live-matches"] });
      toast.success("Watch party updated!");
    } catch {
      toast.error("Failed to update RSVP");
    } finally {
      setRsvping(null);
    }
  };

  const liveMatches = matches.filter((m) => m.status === "live");
  const upcomingMatches = matches.filter((m) => m.status === "upcoming");
  const finishedMatches = matches.filter((m) => m.status === "finished");

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-red-600 to-orange-500 p-6 mb-8 text-white">
          <div className="flex items-center gap-3">
            <Tv2 className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Live Matches</h1>
              <p className="text-white/80 text-sm mt-1">
                {liveMatches.length} match{liveMatches.length !== 1 ? "es" : ""} live now
              </p>
            </div>
          </div>
        </div>

        {/* Sport filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
          {sports.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-colors ${
                filter === s
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-card text-foreground border-border hover:bg-background"
              }`}
            >
              {SPORT_EMOJI[s] || "🏆"} {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading matches…</div>
        ) : (
          <div className="space-y-8">
            {liveMatches.length > 0 && (
              <Section title="🔴 Live Now" matches={liveMatches} onRsvp={handleRsvp} rsvping={rsvping} />
            )}
            {upcomingMatches.length > 0 && (
              <Section title="⏰ Upcoming" matches={upcomingMatches} onRsvp={handleRsvp} rsvping={rsvping} />
            )}
            {finishedMatches.length > 0 && (
              <Section title="✅ Finished" matches={finishedMatches} onRsvp={handleRsvp} rsvping={rsvping} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, matches, onRsvp, rsvping }: { title: string; matches: Match[]; onRsvp: (id: number) => void; rsvping: number | null }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-foreground mb-4">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} onRsvp={onRsvp} rsvping={rsvping} />
        ))}
      </div>
    </section>
  );
}

function MatchCard({ match, onRsvp, rsvping }: { match: Match; onRsvp: (id: number) => void; rsvping: number | null }) {
  const sc = statusConfig[match.status] || statusConfig.upcoming;
  const emoji = SPORT_EMOJI[match.sport] || SPORT_EMOJI.default;
  const isRsvped = match.my_rsvp > 0;

  return (
    <div className={`rounded-xl border bg-card p-5 flex flex-col gap-3 transition-shadow hover:shadow-sm ${match.status === "live" ? "border-red-200 dark:border-red-900" : "border-border"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <span className="text-xs font-semibold text-muted-foreground">{match.title}</span>
        </div>
        <span className={`text-[11px] font-bold uppercase rounded-full px-2.5 py-0.5 ${sc.class}`}>
          {sc.label}
        </span>
      </div>

      {/* Scoreboard */}
      <div className="flex items-center justify-between bg-background rounded-xl px-4 py-3">
        <div className="flex-1 text-center">
          <div className="font-bold text-sm text-foreground leading-tight">{match.team_home}</div>
        </div>
        <div className="px-4 text-center">
          {match.status !== "upcoming" ? (
            <div className="text-xl font-black text-foreground tabular-nums">
              {match.score_home} – {match.score_away}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground font-semibold">
              {new Date(match.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </div>
        <div className="flex-1 text-center">
          <div className="font-bold text-sm text-foreground leading-tight">{match.team_away}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{match.watch_party_count} watching at lounge</span>
        </div>
        {match.status !== "finished" && (
          <button
            onClick={() => onRsvp(match.id)}
            disabled={rsvping === match.id}
            className={`text-xs py-1.5 px-3 rounded-lg border font-semibold transition-colors ${
              isRsvped
                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                : "btn-primary"
            }`}
          >
            {rsvping === match.id ? "…" : isRsvped ? "✓ Watching" : "Watch Here"}
          </button>
        )}
      </div>
    </div>
  );
}
