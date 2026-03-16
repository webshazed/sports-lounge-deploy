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

const Partners = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="pt-32 pb-24">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="section-label section-label-with-lines mb-4">Partnerships</p>
            <h1 className="font-body text-4xl md:text-5xl font-bold text-foreground mb-6">Our Partners</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Sports Lounge partners with brands, organisations, and individuals who share our vision of connecting business and sport.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            {benefits.map((b, i) => (
              <motion.div
                key={b.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="benefit-card"
              >
                <b.icon size={32} className="text-primary mx-auto mb-4" />
                <h3 className="font-body text-lg font-bold text-foreground mb-3">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-2xl mx-auto text-center"
          >
            <h2 className="font-body text-3xl font-bold text-foreground mb-6">Become a Partner</h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Interested in partnering with Sports Lounge? We'd love to explore how we can work together to create value for your brand and our members.
            </p>
            <a href="/contact" className="btn-primary">Get in Touch</a>
          </motion.div>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default Partners;
