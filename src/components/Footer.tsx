const footerLinks = {
  Company: ["About", "Membership", "Events", "Partners", "Contact", "Privacy Policy"],
};

const Footer = () => {
  return (
    <footer className="bg-muted/20 border-t border-border py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-12">
          {/* Brand */}
          <div>
            <img src="/Footer%20Logo.jpg" alt="Sports Lounge" className="h-24 w-auto mb-4 rounded-md object-contain" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              A private members club for professionals who share a passion for sport, opportunity,
              and connections.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4 text-sm tracking-wider uppercase">Quick Links</h4>
            <ul className="space-y-2">
              {footerLinks.Company.map((link) => (
                <li key={link}>
                  <a
                    href={`#${link.toLowerCase().replace(' ', '-')}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Info */}
          <div>
            <h4 className="font-body font-semibold text-foreground mb-4 text-sm tracking-wider uppercase">Registered Office</h4>
            <address className="text-sm text-muted-foreground not-italic leading-relaxed">
              Sports Lounge Global Ltd<br />
              Watergate Building, Crane Wharf<br />
              New Crane Street<br />
              Chester, CH1 4JE<br />
              United Kingdom
            </address>
          </div>
        </div>

        <div className="border-t border-border mt-12 pt-8 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Sports Lounge Global Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
