import { useState } from "react";
import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Plus, X, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

type BizPost = {
  id: number;
  category: string;
  title: string;
  description: string;
  contact: string | null;
  created_at: string;
  user_id: number;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  company: string | null;
};

const CATEGORIES = ["All", "Opportunity", "Investment", "Hiring", "Partnership", "Pitch", "Service"];
const CAT_COLORS: Record<string, string> = {
  Opportunity: "bg-amber-100 text-amber-800",
  Investment: "bg-green-100 text-green-800",
  Hiring: "bg-blue-100 text-blue-800",
  Partnership: "bg-purple-100 text-purple-800",
  Pitch: "bg-red-100 text-red-800",
  Service: "bg-cyan-100 text-cyan-800",
};

export default function BusinessHub() {
  const qc = useQueryClient();
  const [category, setCategory] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form, setForm] = useState({ category: "Opportunity", title: "", description: "", contact: "" });
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["business", category],
    queryFn: () => apiFetch<{ posts: BizPost[] }>(`/api/business${category !== "All" ? `?category=${encodeURIComponent(category)}` : ""}`),
    staleTime: 20_000,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) { toast.error("Title and description required"); return; }
    setSubmitting(true);
    try {
      await apiFetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      toast.success("Posted!");
      setForm({ category: "Opportunity", title: "", description: "", contact: "" });
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["business"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setSubmitting(false);
    }
  };

  const posts = data?.posts || [];

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1e346b] via-[#2a4a8a] to-[#1e346b] p-6 mb-8 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Briefcase className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">Business Hub</h1>
                <p className="text-white/80 text-sm mt-1">Opportunities, partnerships, and investments from the network</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-2 bg-[#d4af37] text-[#1e346b] font-semibold rounded-xl px-4 py-2 text-sm hover:brightness-110 transition-all"
            >
              <Plus className="h-4 w-4" />
              Post Opportunity
            </button>
          </div>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="rounded-2xl border border-border bg-card p-6 mb-8 relative">
            <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
            <div className="font-semibold text-foreground mb-4">New Business Post</div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Category</label>
                  <select
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Contact (optional)</label>
                  <input
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="email or @username"
                    value={form.contact}
                    onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Seeking Series A investment for sports tech startup"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description *</label>
                <textarea
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-none"
                  placeholder="Share the details…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting} className="btn-primary text-sm py-2 px-5">
                  {submitting ? "Posting…" : "Post"}
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="border border-border rounded-lg px-4 py-2 text-sm hover:bg-background">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-colors ${c === category ? "bg-slate-900 text-white border-slate-900" : "bg-card text-foreground border-border hover:bg-background"}`}>
              {c}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading opportunities…</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="font-semibold text-foreground">No posts yet</div>
            <p className="text-sm text-muted-foreground mt-1">Be the first to post an opportunity.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => {
              const isExpanded = expanded === p.id;
              const display = p.full_name || p.username;
              const catColor = CAT_COLORS[p.category] || "bg-muted text-foreground";
              return (
                <div key={p.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start gap-3">
                    <Avatar seed={display} name={display} src={p.avatar_url} className="h-10 w-10 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{display}</span>
                        {p.role && <span className="text-xs text-muted-foreground">{p.role}{p.company ? ` • ${p.company}` : ""}</span>}
                        <span className={`ml-auto text-[11px] font-bold uppercase rounded-full px-2.5 py-0.5 ${catColor}`}>{p.category}</span>
                      </div>
                      <div className="font-semibold text-foreground mt-2 text-sm leading-snug">{p.title}</div>
                      <div className={`text-sm text-foreground/80 mt-1 ${isExpanded ? "" : "line-clamp-2"}`}>{p.description}</div>
                      {p.description.length > 120 && (
                        <button onClick={() => setExpanded(isExpanded ? null : p.id)} className="text-xs text-primary font-semibold mt-1 flex items-center gap-1">
                          {isExpanded ? <><ChevronUp className="h-3 w-3" />Show less</> : <><ChevronDown className="h-3 w-3" />Read more</>}
                        </button>
                      )}
                      {p.contact && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Contact: <span className="font-medium text-foreground">{p.contact}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-2">
                        {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
