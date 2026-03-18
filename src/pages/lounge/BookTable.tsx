import Header from "@/components/Header";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getAuthUser } from "@/lib/auth";

type Area = "Standard" | "VIP" | "Near Screen";
type Guests = 2 | 4 | 6 | 8;

const LOUNGES = ["London Lounge"] as const;

function getToken() {
  try {
    return localStorage.getItem("auth_token") || "";
  } catch {
    return "";
  }
}

async function fetchBookingSummary(location: string, day: string) {
  const token = getToken();
  const sp = new URLSearchParams({ location, day });
  const res = await fetch(`/api/bookings?${sp.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Failed to load booking info");
  return data as { attendingTonight: number; myBookings: any[] };
}

async function createBooking(input: {
  loungeLocation: string;
  startTime: string;
  guests: Guests;
  area: Area;
  matchName?: string;
  extras: { preOrderDrinks: boolean; foodPackage: "None" | "Standard" | "Premium" };
}) {
  const token = getToken();
  const res = await fetch("/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Booking failed");
  return data as { booking: any };
}

export default function BookTable() {
  const me = useMemo(() => getAuthUser(), []);
  const displayName = me?.username || "Member";

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const [location, setLocation] = useState<(typeof LOUNGES)[number]>("London Lounge");
  const [day, setDay] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [time, setTime] = useState("19:00");

  const [guests, setGuests] = useState<Guests>(2);
  const [area, setArea] = useState<Area>("Standard");

  const [preOrderDrinks, setPreOrderDrinks] = useState(false);
  const [foodPackage, setFoodPackage] = useState<"None" | "Standard" | "Premium">("None");
  const [matchName, setMatchName] = useState("");

  const [attending, setAttending] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startTimeIso = `${day}T${time}:00.000Z`;

  const loadFomo = async () => {
    try {
      const s = await fetchBookingSummary(location, day);
      setAttending(s.attendingTonight);
    } catch {
      // ignore
    }
  };

  const next = async () => {
    const nextStep = Math.min(5, (step + 1) as any);
    setStep(nextStep);
    if (nextStep === 4) await loadFomo();
    if (nextStep === 5) await loadFomo();
  };

  const back = () => setStep((s) => (s > 1 ? ((s - 1) as any) : s));

  const confirm = async () => {
    setSubmitting(true);
    try {
      await createBooking({
        loungeLocation: location,
        startTime: startTimeIso,
        guests,
        area,
        matchName: matchName.trim() || undefined,
        extras: { preOrderDrinks, foodPackage },
      });
      toast.success("Booking confirmed");
      setStep(1);
      await loadFomo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-2xl sm:text-3xl font-semibold">Book a Table</div>
            <div className="text-sm text-muted-foreground mt-1">
              Control your real-world club experience.
            </div>
          </div>
          <div className="text-sm text-muted-foreground">Signed in as {displayName}</div>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-6">
          {attending !== null ? (
            <div className="mb-4 text-sm">
              <span className="font-semibold">🔥 {attending}</span>{" "}
              <span className="text-muted-foreground">members booked tables on {day}.</span>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-muted-foreground">Step {step} of 5</div>
            <div className="text-xs text-muted-foreground">Booking flow (MVP)</div>
          </div>

          {step === 1 && (
            <div className="mt-6 space-y-3">
              <div className="text-sm font-semibold">Select Location</div>
              <select
                className="w-full border border-border rounded-lg bg-background px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                value={location}
                onChange={(e) => setLocation(e.target.value as any)}
              >
                {LOUNGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          )}

          {step === 2 && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold">Pick Date</div>
                <input
                  type="date"
                  className="mt-2 w-full border border-border rounded-lg bg-background px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </div>
              <div>
                <div className="text-sm font-semibold">Pick Time</div>
                <input
                  type="time"
                  className="mt-2 w-full border border-border rounded-lg bg-background px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="text-sm font-semibold">Guests</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {([2, 4, 6, 8] as Guests[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGuests(g)}
                      className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                        guests === g
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-background border-border hover:bg-card"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm font-semibold">Area</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(["Standard", "VIP", "Near Screen"] as Area[]).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setArea(a)}
                      className={`px-4 py-3 rounded-xl text-sm font-semibold border transition-colors ${
                        area === a
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-background border-border hover:bg-card"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="mt-6 space-y-5">
              <div>
                <div className="text-sm font-semibold">Extras</div>
                <div className="mt-3 rounded-xl border border-border bg-background p-4">
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold">🍾 Pre-order drinks</span>
                    <input
                      type="checkbox"
                      checked={preOrderDrinks}
                      onChange={(e) => setPreOrderDrinks(e.target.checked)}
                    />
                  </label>
                  <div className="mt-4">
                    <div className="text-sm font-semibold">🍔 Food package</div>
                    <select
                      className="mt-2 w-full border border-border rounded-lg bg-white px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                      value={foodPackage}
                      onChange={(e) => setFoodPackage(e.target.value as any)}
                    >
                      <option value="None">None</option>
                      <option value="Standard">Standard</option>
                      <option value="Premium">Premium</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold">📺 Select match to watch (optional)</div>
                <input
                  className="mt-2 w-full border border-border rounded-lg bg-background px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Arsenal vs Chelsea"
                  value={matchName}
                  onChange={(e) => setMatchName(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="text-sm font-semibold">Confirm booking</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {location} • {day} • {time} • {guests} guests • {area}
                </div>
                {matchName.trim() ? (
                  <div className="mt-2 text-sm text-muted-foreground">Match: {matchName.trim()}</div>
                ) : null}
                <div className="mt-2 text-sm text-muted-foreground">
                  Extras: {preOrderDrinks ? "Pre-order drinks" : "No drinks preorder"} • Food: {foodPackage}
                </div>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={confirm}
                className="w-full btn-primary text-base py-3"
              >
                {submitting ? "Confirming..." : "Confirm Booking"}
              </button>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={step === 1}
              className="px-4 py-2 rounded-lg border border-border bg-background text-sm font-semibold disabled:opacity-50"
            >
              Back
            </button>
            {step < 5 ? (
              <button type="button" onClick={next} className="btn-primary text-sm py-2 px-5">
                Next
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

