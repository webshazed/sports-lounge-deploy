import Header from "@/components/Header";

export default function Placeholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="text-2xl sm:text-3xl font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground mt-2">{description}</div>
          <div className="mt-6 text-sm text-muted-foreground">
            This section is wired and ready — next step is adding database tables + APIs + UI.
          </div>
        </div>
      </div>
    </div>
  );
}

