import { motion } from "framer-motion";
import { Handshake, Play, Briefcase, ShieldCheck } from "lucide-react";

const benefits = [
  {
    icon: Handshake,
    title: "Exclusive Networking",
    description: "Meet business leaders, investors, and athletes in a relaxed members environment.",
  },
  {
    icon: Play,
    title: "Live Sporting Events",
    description: "Watch major sporting events with fellow members in a premium lounge setting.",
  },
  {
    icon: Briefcase,
    title: "Business Opportunities",
    description: "Connect with like-minded professionals and create partnerships.",
  },
  {
    icon: ShieldCheck,
    title: "Private Members Community",
    description: "Access exclusive events, private networking and member experiences.",
  },
];

const MemberBenefits = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="section-label section-label-with-lines mb-4">What Members Get</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, i) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="benefit-card"
            >
              <div className="w-14 h-14 mx-auto mb-5 flex items-center justify-center rounded-sm bg-primary/10 text-primary">
                <benefit.icon size={28} />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground mb-3">
                {benefit.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {benefit.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MemberBenefits;
