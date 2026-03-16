import { motion } from "framer-motion";

const MembershipSection = () => {
  return (
    <section id="membership" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="section-label section-label-with-lines mb-4">Membership</p>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-foreground mb-6">
              Join the Club
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Sports Lounge membership connects you with a growing network of professionals who
              share a passion for sport and success.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-10">
              Members receive exclusive invitations, networking access, and entry to our private
              lounge events.
            </p>
            <a href="#" className="btn-primary">
              Apply for Membership
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default MembershipSection;
