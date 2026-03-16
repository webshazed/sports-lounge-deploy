import { motion } from "framer-motion";
import aboutImg from "@/assets/about-networking.jpg";

const AboutSection = () => {
  return (
    <section id="about" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
          >
            <p className="section-label section-label-with-lines justify-start mb-4">About</p>

            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-8">
              More Than a Club
            </h2>

            <div className="space-y-5 text-muted-foreground leading-relaxed">
              <p>
                Sports Lounge is a private members business club bringing together professionals,
                entrepreneurs, athletes, and sports industry leaders.
              </p>
              <p>
                Our lounges combine networking, live sport, business discussion, and exclusive events
                in a premium environment designed for ambitious people.
              </p>
              <p>
                Whether you want to meet clients, watch live sport, or expand your network, Sports
                Lounge gives you the platform to connect.
              </p>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1], delay: 0.1 }}
          >
            <img
              src={aboutImg}
              alt="Members networking at Sports Lounge"
              className="w-full h-[400px] object-cover rounded-sm"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
