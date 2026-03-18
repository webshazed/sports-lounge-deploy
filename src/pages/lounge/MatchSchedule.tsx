import Header from "@/components/Header";
import { useMemo, useState } from "react";
import { getAuthUser } from "@/lib/auth";

type Filter = "Today" | "This Week";
type League = "All" | "Premier League" | "Champions League" | "La Liga";

const matches = [
  {
    id: "m1",
    title: "Arsenal vs Chelsea",
    time: "7:00 PM",
    date: "Today",
    league: "Premier League" as const,
    location: "London Lounge",
    attending: 8,
  },
  {
    id: "m2",
    title: "Barcelona vs Madrid",
    time: "9:30 PM",
    date: "Today",
    league: "La Liga" as const,
    location: "London Lounge",
    attending: 5,
  },
  {
    id: "m3",
    title: "PSG vs Inter",
    time: "8:00 PM",
    date: "This Week",
    league: "Champions League" as const,
    location: "London Lounge",
    attending: 12,
  },
] as const;

export default function MatchSchedule() {
  const me = useMemo(() => getAuthUser(), []);
  const displayName = me?.username || "Member";

  const [filter, setFilter] = useState<Filter>("Today");
  const [league, setLeague] = useState<League>("All");

  const filtered = matches.filter((m) => {
    if (filter !== m.date) return false;
    if (league !== "All" && m.league !== league) return false;
    return true;
  });

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-2xl sm:text-3xl font-semibold">Match Schedule</div>
            <div className="text-sm text-muted-foreground mt-1">
              What’s playing in the lounge — book a table and coordinate watch parties.
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Signed in as {displayName}</div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {(["Today", "This Week"] as Filter[]).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                  filter === t ? "bg-slate-900 text-white border-slate-900" : "bg-background border-border hover:bg-card"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">League</span>
            <select
              className="border border-border rounded-lg bg-background px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              value={league}
              onChange={(e) => setLeague(e.target.value as League)}
            >
              {(["All", "Premier League", "Champions League", "La Liga"] as League[]).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">{m.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    🕒 {m.time} • 📍 {m.location} • 🏟 {m.league}
                  </div>
                  <div className="text-sm mt-2">
                    <span className="font-semibold">🟢 {m.attending}</span>{" "}
                    <span className="text-muted-foreground">members attending</span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a href="/lounge/book" className="btn-primary text-sm py-2 px-4 text-center">
                    Book Table
                  </a>
                  <button className="border border-border rounded-md bg-background px-4 py-2 text-sm font-semibold hover:bg-card transition-colors">
                    Join Chat
                  </button>
                </div>
              </div>
            </div>
          ))}

          {!filtered.length ? (
            <div className="text-sm text-muted-foreground">No matches found for these filters.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

