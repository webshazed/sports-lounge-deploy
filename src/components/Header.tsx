import { useState } from "react";
import { Search, Menu, X } from "lucide-react";

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: "Home", href: "/" },
    { label: "About", href: "/#about" },
    { label: "Membership", href: "/#membership" },
    { label: "Events", href: "/#events" },
    { label: "Partners", href: "/partners" },
    { label: "Contact", href: "/contact" },
  ];

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
          <button className="text-slate-700 hover:text-slate-900 transition-colors">
            <Search size={18} />
          </button>
          <a href="#" className="text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
            Sign In
          </a>
          <a href="/register" className="btn-primary text-xs py-2 px-5">
            Become a Member
          </a>
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
              <a href="#" className="text-sm font-medium text-slate-700">Sign In</a>
              <a href="/register" className="btn-primary text-center text-xs py-2">Become a Member</a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
