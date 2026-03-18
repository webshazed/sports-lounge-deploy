import Header from "@/components/Header";
// Member perks are static for MVP

const perks = [
  {
    title: "🍸 Lounge Benefits",
    items: ["20% off drinks", "Priority seating on big match nights", "VIP match seating (tier-based)"],
  },
  {
    title: "🎟 Event Benefits",
    items: ["Priority event access", "Early access to guest lists", "VIP-only events (Elite & Founding)"],
  },
  {
    title: "🤝 Business Benefits",
    items: ["Access to Business Hub", "Private networking groups", "Collaboration & pitch opportunities"],
  },
] as const;

export default function MemberPerks() {
  useMemo(() => getAuthUser(), []);

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div>
          <div className="text-2xl sm:text-3xl font-semibold">Member Perks</div>
          <div className="text-sm text-muted-foreground mt-1">
            Exclusive benefits that reinforce value and status.
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {perks.map((p) => (
            <div key={p.title} className="rounded-2xl border border-border bg-card p-5">
              <div className="font-semibold">{p.title}</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {p.items.map((i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-foreground">•</span>
                    <span>{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="font-semibold">Status-based perks</div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="font-semibold">Gold Member</div>
              <div className="text-muted-foreground mt-2">✔ Priority booking • ✔ VIP seating</div>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="font-semibold">Elite Member</div>
              <div className="text-muted-foreground mt-2">✔ Free event access • ✔ Concierge service</div>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="font-semibold">Founding Member</div>
              <div className="text-muted-foreground mt-2">✔ Priority everything • ✔ Private nights</div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <a href="/lounge/book" className="btn-primary inline-flex text-sm py-2 px-5">
            Book a Table
          </a>
        </div>
      </div>
    </div>
  );
}

