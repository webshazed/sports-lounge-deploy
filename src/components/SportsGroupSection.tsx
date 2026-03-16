import { motion } from "framer-motion";

const SportsGroupSection = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="section-label section-label-with-lines mb-4">Network</p>
            <h2 className="font-body text-4xl font-bold text-foreground mb-6">
              Part of the Sports Group Network
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Sports Lounge is part of the Sports Group ecosystem, connecting business and sport
              through events, media platforms, and athlete partnerships.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default SportsGroupSection;
