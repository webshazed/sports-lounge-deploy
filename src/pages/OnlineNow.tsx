import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Users, Activity } from "lucide-react";

type OnlineUser = {
  id: number;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: string | null;
  lastSeen: string;
};

export default function OnlineNow() {
  const me = getAuthUser();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["online"],
    queryFn: () => apiFetch<{ users: OnlineUser[] }>("/api/online"),
    staleTime: 30000,
  });

  const onlineUsers = data?.users?.filter(u => u.id !== me?.id) || [];

  return (
    <div className="theme-light min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 pb-20">
        <div className="rounded-3xl bg-slate-900 border border-border p-8 mb-10 text-white relative overflow-hidden flex flex-col md:flex-row items-center md:items-start justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e346b]/40 via-[#d4af37]/10 to-transparent pointer-events-none" />
          <div className="relative z-10 max-w-xl text-center md:text-left">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center justify-center md:justify-start gap-3">
              <Activity className="h-8 w-8 text-[#d4af37]" /> Online Now
            </h1>
            <p className="text-white/80">
              See who is currently active in the Sports Lounge network. Connect, chat, and build relationships in real-time.
            </p>
          </div>
          <div className="relative z-10 mt-6 md:mt-0 flex flex-col items-center bg-white/10 px-6 py-4 rounded-2xl backdrop-blur-md border border-white/20">
            <div className="text-4xl font-black">{isLoading ? "-" : onlineUsers.length}</div>
            <div className="text-xs uppercase tracking-wider font-semibold text-white/70 mt-1">Active Members</div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-pulse">
            <Activity className="h-10 w-10 mb-4 opacity-50" />
            <p>Scanning network...</p>
          </div>
        ) : onlineUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-border bg-card rounded-2xl text-center px-4">
            <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <Users className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold mb-2">It's a bit quiet right now</h3>
            <p className="text-muted-foreground max-w-md">
              There are no other members active at the moment. Check back later or start a discussion in the feed!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {onlineUsers.map((u) => {
              const display = u.fullName || u.username;
              return (
                <div 
                  key={u.id} 
                  className="group rounded-2xl border border-border bg-card p-5 flex flex-col items-center text-center hover:shadow-lg transition-all hover:-translate-y-1 relative cursor-pointer"
                  onClick={() => navigate(`/profile/${u.username}`)}
                >
                  <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                  
                  <Avatar 
                    seed={display} 
                    name={display} 
                    src={u.avatarUrl || undefined} 
                    className="h-20 w-20 mb-4 border-2 border-border shadow-sm group-hover:border-primary transition-colors" 
                  />
                  
                  <h3 className="font-bold text-foreground text-lg mb-1 line-clamp-1 w-full">{display}</h3>
                  <p className="text-xs text-muted-foreground mb-4 line-clamp-1 w-full bg-muted/50 px-3 py-1 rounded-full">
                    {u.role || "Gold Member"}
                  </p>
                  
                  <div className="flex gap-2 w-full mt-auto">
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate("/messages"); }}
                      className="flex-1 btn-primary py-2 text-xs"
                    >
                      Message
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); navigate(`/profile/${u.username}`); }}
                      className="flex-1 border border-border rounded-lg hover:bg-background transition-colors py-2 text-xs font-semibold"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
