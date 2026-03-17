import { motion } from "framer-motion";
import lounge1 from "@/assets/lounge-1.jpg";
import lounge2 from "@/assets/lounge-2.jpg";
import lounge3 from "@/assets/lounge-3.jpg";
import lounge4 from "@/assets/lounge-4.jpg";

const images = [
  { src: lounge1, alt: "Premium lounge viewing area" },
  { src: lounge2, alt: "Members networking event" },
  { src: lounge3, alt: "Guest speaker series" },
  { src: lounge4, alt: "Drinks and lounge atmosphere" },
];

const LoungeExperience = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="section-label section-label-with-lines mb-4">The Experience</p>
          <h2 className="font-body text-4xl font-bold text-foreground mb-6">
            The Lounge Experience
          </h2>
        </motion.div>

        {/* Gallery */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {images.map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="overflow-hidden rounded-sm"
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-48 lg:h-56 object-cover hover:scale-105 transition-transform duration-500"
              />
            </motion.div>
          ))}
        </div>

        <div className="max-w-2xl mx-auto text-center space-y-4 text-muted-foreground leading-relaxed">
          <p>
            The Sports Lounge is designed to be a place where conversations turn into opportunities.
          </p>
          <p>
            Host meetings, relax with friends, or enjoy live sporting moments with fellow members.
          </p>
        </div>

        {/* Community */}
        <div className="max-w-3xl mx-auto mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <p className="section-label section-label-with-lines mb-4">The Community</p>
            <h3 className="font-body text-3xl md:text-4xl font-bold text-foreground mb-6">
              A Community of Ambitious People
            </h3>

            <div className="space-y-4 text-muted-foreground leading-relaxed">
              <p>
                Sports Lounge brings together professionals, entrepreneurs, athletes and decision makers who share a
                passion for sport and business.
              </p>
              <p>
                Our members connect through events, conversations and opportunities that simply don’t happen anywhere
                else.
              </p>
              <p>
                Once you become a member, you also gain access to the{" "}
                <span className="font-semibold text-foreground">Sports Lounge online community</span> — a private digital
                platform where members and professional sportspeople can connect, chat, share ideas and build
                relationships.
              </p>
              <p>
                Think of it as a{" "}
                <span className="font-semibold text-foreground">private social network for sport and business</span>,
                where members can message each other, post updates, and collaborate within the Sports Lounge community.
              </p>
              <p>
                From casual conversations over live sport to strategic partnerships, Sports Lounge is where
                relationships are built.
              </p>
            </div>
          </motion.div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-sm border border-border/60 bg-background/40 px-5 py-4 text-left">
              <div className="text-lg font-semibold text-foreground">👥 Members Network</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Connect with vetted members across sport and business.
              </div>
            </div>
            <div className="rounded-sm border border-border/60 bg-background/40 px-5 py-4 text-left">
              <div className="text-lg font-semibold text-foreground">💬 Private Messaging</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Start conversations and build relationships directly.
              </div>
            </div>
            <div className="rounded-sm border border-border/60 bg-background/40 px-5 py-4 text-left">
              <div className="text-lg font-semibold text-foreground">📢 Member Updates</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Share updates, ideas, and opportunities with the community.
              </div>
            </div>
            <div className="rounded-sm border border-border/60 bg-background/40 px-5 py-4 text-left">
              <div className="text-lg font-semibold text-foreground">🤝 Business Connections</div>
              <div className="mt-1 text-sm text-muted-foreground">
                Turn introductions into partnerships and outcomes.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LoungeExperience;
