import { useEffect, useState } from "react";
import { Menu, X, MessageSquare, ChevronDown } from "lucide-react";
import { AUTH_CHANGED_EVENT, isAuthed, logout as doLogout, getAuthUser } from "@/lib/auth";
import Avatar from "@/components/Avatar";
import { apiFetch } from "@/lib/api";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<{ username: string; fullName?: string; avatarUrl?: string | null } | null>(null);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/#about" },
    { label: "Membership", href: "/#membership" },
    { label: "Events", href: "/#events" },
    { label: "Partners", href: "/partners" },
    { label: "Contact", href: "/contact" },
  ];

  useEffect(() => {
    const sync = async () => {
      const isA = isAuthed();
      setAuthed(isA);
      const u = getAuthUser();
      if (u) {
        setUser({ 
          username: u.username || "", 
          fullName: u.fullName, 
          avatarUrl: u.avatarUrl 
        });
        
        // If missing deep info, fetch it once
        if (!u.avatarUrl && !u.fullName) {
          try {
            const data = await apiFetch<{ user: any; profile: any }>("/api/me");
            const updated = { 
              ...u, 
              fullName: data.profile?.fullName, 
              avatarUrl: data.profile?.avatarUrl 
            };
            localStorage.setItem("auth_user", JSON.stringify(updated));
            setUser({ 
              username: updated.username || "", 
              fullName: updated.fullName, 
              avatarUrl: updated.avatarUrl 
            });
          } catch (e) {
            // silent
          }
        }
      } else {
        setUser(null);
      }
    };
    sync();

    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const logout = () => {
    doLogout();
    setMobileOpen(false);
  };

  return (
    <header className="bg-white border-b border-border shadow-sm">
      <div className="container mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center">
          <img src="/Logo-1.png" alt="Sports Lounge" className="h-10 w-auto" />
        </a>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden lg:flex items-center gap-4">
          {!authed && (
            <>
              <a
                href="/signin"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Sign In
              </a>
              <a href="/register" className="btn-primary text-xs py-2 px-5">
                Become a Member
              </a>
            </>
          )}
          {authed && (
            <>
              <a
                href="/dashboard"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/messages"
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors flex items-center gap-1.5"
              >
                <MessageSquare className="h-4 w-4" />
                Messages
              </a>
              <a
                href={user?.username ? `/profile/${user.username}` : "/profile"}
                className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-slate-100 transition-all border border-transparent hover:border-border group"
              >
                <Avatar 
                  seed={user?.username || "Guest"} 
                  src={user?.avatarUrl} 
                  name={user?.fullName || user?.username} 
                  className="h-8 w-8 ring-2 ring-transparent group-hover:ring-primary/20 transition-all" 
                />
                <div className="hidden xl:flex flex-col items-start -space-y-0.5">
                   <span className="text-xs font-bold text-slate-900 leading-none">{user?.fullName || user?.username}</span>
                   <span className="text-[10px] text-muted-foreground">View Profile</span>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
              <button
                onClick={logout}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Logout
              </button>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden text-slate-900"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-border shadow-md">
          <nav className="container mx-auto px-6 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-slate-700 hover:text-slate-900 py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-border flex flex-col gap-3">
              {!authed && (
                <>
                  <a
                    href="/signin"
                    className="text-sm font-medium text-slate-700"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign In
                  </a>
                  <a
                    href="/register"
                    className="btn-primary text-center text-xs py-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    Become a Member
                  </a>
                </>
              )}
              {authed && (
                <>
                  <a
                    href="/dashboard"
                    className="flex items-center gap-3 py-3 border-b border-border"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Avatar 
                      seed={user?.username || "Guest"} 
                      src={user?.avatarUrl} 
                      className="h-10 w-10" 
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{user?.fullName || user?.username}</span>
                      <span className="text-xs text-muted-foreground">Dashboard & Profile</span>
                    </div>
                  </a>
                  <a
                    href="/messages"
                    className="text-sm font-medium text-slate-700 flex items-center gap-2 py-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Messages
                  </a>
                  <button
                    onClick={logout}
                    className="text-left text-sm font-medium text-slate-700 py-2"
                  >
                    Logout
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
