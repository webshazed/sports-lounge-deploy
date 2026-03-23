import { useState } from "react";
import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Users, Plus, X } from "lucide-react";
import { toast } from "sonner";

type Event = {
  id: number;
  title: string;
  startsAt: string;
  location: string | null;
  rsvpCount: number;
  myRsvp?: boolean;
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function Events() {
  const user = getAuthUser();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", startsAt: "", location: "" });
  const [submitting, setSubmitting] = useState(false);
  const [rsvping, setRsvping] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<{ events: Event[] }>("/api/events?limit=50&from=2020-01-01"),
    staleTime: 20_000,
  });

  const handleRsvp = async (eventId: number) => {
    setRsvping(eventId);
    try {
      await apiFetch(`/api/events/${eventId}/rsvp`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["events"] });
      toast.success("RSVP updated!");
    } catch {
      toast.error("Failed to RSVP");
    } finally {
      setRsvping(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.startsAt) { toast.error("Title and date required"); return; }
    setSubmitting(true);
    try {
      await apiFetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, startsAt: form.startsAt, location: form.location }),
      });
      toast.success("Event created!");
      setForm({ title: "", startsAt: "", location: "" });
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["events"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  const events = data?.events || [];
  const upcoming = events.filter((e) => new Date(e.startsAt) >= new Date());
  const past = events.filter((e) => new Date(e.startsAt) < new Date());

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1e346b] to-[#d4af37] p-6 mb-8 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold">Events</h1>
              <p className="text-white/80 text-sm mt-1">
                {upcoming.length} upcoming event{upcoming.length !== 1 ? "s" : ""} in the network
              </p>
            </div>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-2 bg-white text-[#1e346b] font-semibold rounded-xl px-4 py-2 text-sm hover:bg-white/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Event
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="rounded-2xl border border-border bg-card p-6 mb-8 relative">
            <button
              onClick={() => setShowCreate(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="font-semibold text-foreground mb-4">New Event</div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Champions League Watch Party"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.startsAt}
                    onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Location</label>
                  <input
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Sports Lounge, Mayfair"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting} className="btn-primary text-sm py-2 px-5">
                  {submitting ? "Creating…" : "Create Event"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="border border-border rounded-lg px-4 py-2 text-sm hover:bg-background">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading events…</div>
        ) : (
          <div className="space-y-8">
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-foreground mb-4">Upcoming Events</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {upcoming.map((evt) => (
                    <EventCard key={evt.id} evt={evt} userId={user?.id} onRsvp={handleRsvp} rsvping={rsvping} />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-foreground mb-4 text-muted-foreground">Past Events</h2>
                <div className="grid gap-4 sm:grid-cols-2 opacity-70">
                  {past.map((evt) => (
                    <EventCard key={evt.id} evt={evt} userId={user?.id} onRsvp={handleRsvp} rsvping={rsvping} past />
                  ))}
                </div>
              </section>
            )}
            {events.length === 0 && (
              <div className="text-center py-20">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="font-semibold text-foreground">No events yet</div>
                <p className="text-sm text-muted-foreground mt-1">Be the first to create one!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({
  evt, userId, onRsvp, rsvping, past,
}: {
  evt: Event; userId?: number; onRsvp: (id: number) => void; rsvping: number | null; past?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#1e346b] to-[#d4af37] flex flex-col items-center justify-center text-white flex-shrink-0">
          <div className="text-[11px] font-bold uppercase">{new Date(evt.startsAt).toLocaleString("en", { month: "short" })}</div>
          <div className="text-xl font-bold leading-none">{new Date(evt.startsAt).getDate()}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground text-sm leading-tight">{evt.title}</div>
          <div className="text-xs text-muted-foreground mt-1">{formatDate(evt.startsAt)}</div>
          {evt.location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" /> {evt.location}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>{evt.rsvpCount} attending</span>
        </div>
        {!past && (
          <button
            onClick={() => onRsvp(evt.id)}
            disabled={rsvping === evt.id}
            className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
          >
            {rsvping === evt.id ? "…" : "RSVP"}
          </button>
        )}
      </div>
    </div>
  );
}
