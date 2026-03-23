import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";

type SavedPost = {
  id: number;
  kind: string;
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaUrls: string[];
  createdAt: string;
  stats: { likes: number; comments: number };
  author: { id: number; username: string; fullName: string | null; role: string | null; company: string | null; avatarUrl: string | null };
};

export default function Saved() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["saved"],
    queryFn: () => apiFetch<{ posts: SavedPost[] }>("/api/saved"),
    staleTime: 20_000,
  });

  const unsave = async (postId: number) => {
    try {
      await apiFetch(`/api/feed/${postId}/save`, { method: "POST" });
      qc.invalidateQueries({ queryKey: ["saved"] });
      toast.success("Removed from saved");
    } catch {
      toast.error("Failed to unsave");
    }
  };

  const posts = data?.posts || [];

  return (
    <div className="theme-light min-h-screen bg-background text-foreground">
      <Header />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 p-6 mb-8 text-white">
          <div className="flex items-center gap-3">
            <Bookmark className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">Saved</h1>
              <p className="text-white/80 text-sm mt-1">{posts.length} saved item{posts.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading saved posts…</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Bookmark className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="font-semibold text-foreground">Nothing saved yet</div>
            <p className="text-sm text-muted-foreground mt-1">Tap the bookmark icon on any post to save it here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => {
              const authorName = p.author.fullName || p.author.username || "Member";
              const authorRole = p.author.role || (p.author.company ? `Member • ${p.author.company}` : "Member");
              const allMedia = p.mediaUrls.length > 0 ? p.mediaUrls : (p.mediaUrl ? [p.mediaUrl] : []);
              return (
                <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar seed={authorName} name={authorName} src={p.author.avatarUrl || undefined} className="h-10 w-10" />
                      <div>
                        <div className="font-semibold text-foreground text-sm">{authorName}</div>
                        <div className="text-xs text-muted-foreground">{authorRole}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => unsave(p.id)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors text-amber-500"
                      title="Remove from saved"
                    >
                      <BookmarkCheck className="h-5 w-5" />
                    </button>
                  </div>
                  {allMedia.length > 0 && (
                    <div className={`mt-3 grid gap-1 rounded-lg overflow-hidden ${allMedia.length === 1 ? "" : allMedia.length === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
                      {allMedia.slice(0, 4).map((url, idx) => (
                        <div key={idx} className={`relative ${allMedia.length === 3 && idx === 0 ? "row-span-2" : ""}`}>
                          {p.mediaType?.startsWith("video") ? (
                            <video src={url} className="w-full h-full object-contain rounded" controls />
                          ) : (
                            <img src={url} alt="" className="w-full h-48 object-contain bg-muted rounded" />
                          )}
                          {idx === 3 && allMedia.length > 4 && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded text-white font-bold text-lg">
                              +{allMedia.length - 4}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {p.content && <div className="mt-3 text-sm text-foreground/90 whitespace-pre-line">{p.content}</div>}
                  <div className="mt-3 text-xs text-muted-foreground">
                    👍 {p.stats.likes} · 💬 {p.stats.comments} · {new Date(p.createdAt).toLocaleDateString()}
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
