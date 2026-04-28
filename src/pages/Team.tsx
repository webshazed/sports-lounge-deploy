import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";

type TeamMember = {
  name: string;
  image: string;
  bio: string[];
  links: { label: string; href: string }[];
};

const team: TeamMember[] = [
  {
    name: "Majid Lavji",
    image: "/Majid Lavji.jpg",
    bio: [
      "Is the CEO of Sports Group Ltd. With over two decades of experience in sports events and management, Majid has knowledge of the industry in Asia, Europe, and Africa.",
      "Majid's work includes creating national sporting events, coaching, and managing athletes. Majid is also the founder of AsiaEurope Network.",
    ],
    links: [
      { label: "SportsGroup.uk", href: "https://www.sportsgroup.uk" },
      { label: "MajidLavji.com", href: "https://www.majidlavji.com" },
    ],
  },
  {
    name: "Anthony Richardson",
    image: "/Anthony Richardson.png",
    bio: [
      "Anthony, a seasoned veteran in the world of building, construction and finance. For three decades, he has immersed himself in projects spanning across the United Kingdom, France, and the UAE.",
      "With his extensive experience, he brings a wealth of knowledge and expertise to the table. Anthony heads the financial firm Wealth Bridge Management based in Dubai.",
    ],
    links: [{ label: "WealthBridgeManagement.com", href: "https://www.wealthbridgemanagement.com" }],
  },
  {
    name: "Julie Tooby",
    image: "/Julie Tooby.jpg",
    bio: [
      "With over 15 years' experience curating high-end events and forging meaningful connections, Julie brings a unique blend of hospitality, intuition and strategic matchmaking to the club.",
      "From luxury weddings to business gatherings, her talent lies in creating spaces where introductions lead to genuine opportunity.",
      "Passionate about intelligent networking and purposeful connection, Julie's vision is to build a dynamic events-led business lounge with a strong focus on empowering women through sport, conversation and community.",
    ],
    links: [{ label: "synergylink.co.uk", href: "https://www.synergylink.co.uk" }],
  },
  {
    name: "Tim McInally",
    image: "/Tim McInally.jpg",
    bio: [
      "Tim has over 18 years of experience in the financial services industry, holding senior roles. After earning his AAT qualification, he worked in accountancy, supporting the oil and gas industry with tax-efficient vehicle solutions and later driving business development.",
      "He transitioned into mortgage broking, qualifying for CeMAP and founding The Advice Centre. Over seven years, he built The Advice Centre into a thriving business and developed a strong understanding of the industry's challenges.",
      "Passionate about improving mortgage systems, he focuses on efficiency, transparency, and customer-centric solutions.",
      "He is also Chief Operating Officer at Ingard Financial, a fast-growing mortgage network.",
      "Tim also serves as Client Manager at Boxing Management Limited, where he helps athletes secure and future-proof their income. Additionally, he holds Director positions in property development companies, working to provide affordable housing and turning derelict properties into liveable accommodation.",
    ],
    links: [{ label: "TheAdviceCentre.co.uk", href: "https://www.theadvicecentre.co.uk" }],
  },
];

export default function Team() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-10 top-20 h-72 w-72 rounded-full bg-[#3b5998]/10 blur-3xl" />
          <div className="absolute right-10 top-32 h-96 w-96 rounded-full bg-amber-200/35 blur-3xl" />
        </div>

        <div className="container relative z-10 mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-14 max-w-3xl text-center"
          >
            <p className="section-label section-label-with-lines mb-4">Team</p>
            <h1 className="font-body mb-5 text-4xl font-bold text-slate-900 md:text-5xl">
              Meet The Team
            </h1>
            <p className="text-lg leading-relaxed text-slate-600">
              The people shaping Sports Lounge bring together deep experience across sport, finance, events, and strategic growth.
            </p>
          </motion.div>

          <div className="space-y-8">
            {team.map((member, index) => (
              <motion.article
                key={member.name}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/70"
              >
                <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="border-b border-slate-200 bg-gradient-to-br from-slate-100 via-white to-slate-50 p-6 lg:border-b-0 lg:border-r">
                    <img
                      src={member.image}
                      alt={member.name}
                      className="h-[320px] w-full rounded-3xl object-cover object-top shadow-lg shadow-slate-300/40"
                    />
                  </div>

                  <div className="p-6 md:p-8 lg:p-10">
                    <h2 className="text-3xl font-bold text-slate-900">{member.name}</h2>
                    <div className="mt-5 space-y-4 text-[15px] leading-7 text-slate-700">
                      {member.bio.map((paragraph, paragraphIndex) => (
                        <p key={`${member.name}-${paragraphIndex}`}>{paragraph}</p>
                      ))}
                    </div>

                    <div className="mt-8 flex flex-wrap gap-3">
                      {member.links.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-[#1e346b] shadow-sm transition hover:-translate-y-0.5 hover:border-[#3b5998]/40 hover:bg-white hover:shadow-md"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
