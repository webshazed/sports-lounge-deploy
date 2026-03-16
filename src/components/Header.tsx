import { useState } from "react";
import { Search, Menu, X } from "lucide-react";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = ["Home", "About", "Membership", "Events", "Partners", "Contact"];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            SP<span className="text-primary">⚽</span>RTS
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-foreground">LOUNGE</span>
        </a>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {link}
            </a>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden lg:flex items-center gap-4">
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Search size={18} />
          </button>
          <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Sign In
          </a>
          <a href="/register" className="btn-primary text-xs py-2 px-5">
            Become a Member
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-background border-t border-border">
          <nav className="container mx-auto px-6 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`#${link.toLowerCase()}`}
                className="text-sm font-medium text-muted-foreground hover:text-foreground py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link}
              </a>
            ))}
            <div className="pt-3 border-t border-border flex flex-col gap-3">
              <a href="#" className="text-sm font-medium text-muted-foreground">Sign In</a>
              <a href="#membership" className="btn-primary text-center text-xs py-2">Become a Member</a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
