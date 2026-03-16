import { motion } from "framer-motion";
import ctaBg from "@/assets/cta-bg.jpg";

const FinalCTA = () => {
  return (
    <section className="relative py-32 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${ctaBg})` }}
      />
      <div className="absolute inset-0 bg-background/80" />

      <div className="relative z-10 container mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.19, 1, 0.22, 1] }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
            Ready to Join the Club?
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-10">
            Become part of the Sports Lounge community and connect with professionals who share
            your passion for sport and success.
          </p>
          <a href="#membership" className="btn-primary">
            Become a Member
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;
