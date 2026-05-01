const footerLinks = {
  Company: ["About", "Membership", "Events", "Partners", "Contact", "Privacy Policy"],
};

type FooterProps = {
  lightText?: boolean;
};

const Footer = ({ lightText = false }: FooterProps) => {
  const headingClass = lightText ? "text-slate-900" : "text-foreground";
  const bodyClass = lightText ? "text-slate-700" : "text-muted-foreground";
  const hoverClass = lightText ? "hover:text-slate-900" : "hover:text-foreground";

  return (
    <footer className="bg-muted/20 border-t border-border py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-12">
          <div>
            <img src="/Footer%20Logo.jpg" alt="Sports Lounge" className="h-24 w-auto mb-4 rounded-md object-contain" />
            <p className={`text-sm leading-relaxed ${bodyClass}`}>
              A private members club for professionals who share a passion for sport, opportunity,
              and connections.
            </p>
          </div>

          <div>
            <h4 className={`mb-4 text-sm font-semibold tracking-wider uppercase ${headingClass}`}>Quick Links</h4>
            <ul className="space-y-2">
              {footerLinks.Company.map((link) => (
                <li key={link}>
                  <a
                    href={`#${link.toLowerCase().replace(" ", "-")}`}
                    className={`text-sm transition-colors ${bodyClass} ${hoverClass}`}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className={`mb-4 text-sm font-body font-semibold tracking-wider uppercase ${headingClass}`}>
              Registered Office
            </h4>
            <address className={`text-sm not-italic leading-relaxed ${bodyClass}`}>
              Sports Lounge Global Ltd<br />
              Watergate Building, Crane Wharf<br />
              New Crane Street<br />
              Chester, CH1 4JE<br />
              United Kingdom
            </address>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-8 text-center">
          <p className={`text-xs ${bodyClass}`}>
            © {new Date().getFullYear()} Sports Lounge is part of Sports Group Ltd
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
