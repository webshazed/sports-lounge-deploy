import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { Handshake, Globe, Users, TrendingUp } from "lucide-react";

const benefits = [
  {
    icon: Globe,
    title: "Brand Exposure",
    desc: "Showcase your brand to our network of professionals, entrepreneurs, and sports industry leaders.",
  },
  {
    icon: Users,
    title: "Networking Access",
    desc: "Connect with our members at exclusive events and private gatherings.",
  },
  {
    icon: Handshake,
    title: "Strategic Partnerships",
    desc: "Collaborate on events, content, and initiatives that align sport with business.",
  },
  {
    icon: TrendingUp,
    title: "Growth Opportunities",
    desc: "Tap into new markets through our expanding network of lounges and members.",
  },
];

const partners = [
  {
    title: "Sports Partner",
    image: "/Sports Partner.jpg",
    href: "https://sportsgroup.uk/",
  },
  {
    title: "Mortgage Partner",
    image: "/Mortgage Partner.png",
    href: "https://ourhome.mortgage/",
  },
  {
    title: "Finance Partner",
    image: "/Finance Partner.png",
    href: "https://wealthbridgemanagement.com/",
  },
  {
    title: "Drinks Partner",
    image: "/Drinks Partner.jpg",
    href: "https://liverpooldistillery.uk/",
  },
  {
    title: "Events Partner",
    image: "/Events Partner.png",
    href: "http://www.synergylink.co.uk/",
  },
  {
    title: "Loyalty Programme Partner",
    image: "/Loyalty Programme Partner.png",
    href: "http://www.infinityconnectuk.com/",
  },
  {
    title: "Telecoms Partner",
    image: "/Telecoms Partner.jpg",
    href: "https://esimglobal.uk/",
  },
];

const Partners = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-[#3b5998]/10 blur-3xl" />
          <div className="absolute right-10 top-32 h-96 w-96 rounded-full bg-amber-200/35 blur-3xl" />
        </div>

        <div className="container relative z-10 mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-16 text-center"
          >
            <p className="section-label section-label-with-lines mb-4">Partnerships</p>
            <h1 className="font-body mb-6 text-4xl font-bold text-slate-900 md:text-5xl">Our Partners</h1>
            <p className="mx-auto max-w-2xl leading-relaxed text-slate-600">
              Sports Lounge partners with brands, organisations, and individuals who share our vision of connecting business and sport.
            </p>
          </motion.div>

          <div className="mb-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg shadow-slate-200/60"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3b5998]/10 text-[#1e346b]">
                  <b.icon size={28} />
                </div>
                <h3 className="font-body mb-3 text-lg font-bold text-slate-900">{b.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{b.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-20 rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70 md:p-12"
          >
            <div className="mb-10 max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#3b5998]">
                Sports Lounge Partners and Sponsors
              </p>
              <h2 className="mt-4 font-body text-3xl font-bold text-slate-900 md:text-4xl">
                Trusted brands supporting our business and sports network
              </h2>
              <p className="mt-4 leading-relaxed text-slate-600">
                Explore the partners and sponsors helping Sports Lounge bring together premium networking, events, and member experiences.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {partners.map((partner, index) => (
                <motion.a
                  key={partner.title}
                  href={partner.href}
                  target="_blank"
                  rel="noreferrer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1 + index * 0.05 }}
                  className="group flex flex-col rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#3b5998]/40 hover:bg-white hover:shadow-lg"
                >
                  <div className="flex h-40 items-center justify-center rounded-2xl bg-white p-5 shadow-sm">
                    <img
                      src={partner.image}
                      alt={partner.title}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-800">
                      {partner.title}
                    </h3>
                    <span className="text-lg font-semibold text-[#1e346b] transition group-hover:translate-x-0.5">
                      ↗
                    </span>
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mx-auto max-w-2xl rounded-[32px] border border-slate-200 bg-white p-10 text-center shadow-xl shadow-slate-200/70"
          >
            <h2 className="font-body mb-6 text-3xl font-bold text-slate-900">Become a Partner</h2>
            <p className="mb-8 leading-relaxed text-slate-600">
              Interested in partnering with Sports Lounge? We'd love to explore how we can work together to create value for your brand and our members.
            </p>
            <a href="/contact" className="btn-primary">
              Get in Touch
            </a>
          </motion.div>
        </div>
      </section>

      <Footer lightText />
    </div>
  );
};

export default Partners;
