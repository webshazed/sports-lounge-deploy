import { motion } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="absolute inset-0 bg-background/70" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-background/60" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center pt-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
          className="max-w-3xl mx-auto"
        >
          <p className="section-label section-label-with-lines mb-6">About</p>

          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
            Where Business Meets Sport
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            A private members club for professionals who share a passion for sport, opportunity, and connections.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#membership" className="btn-primary">
              Become a Member
            </a>
            <a href="#about" className="btn-secondary">
              Explore the Club
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
