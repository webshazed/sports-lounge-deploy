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
          <h2 className="font-display text-4xl font-bold text-foreground mb-6">
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
      </div>
    </section>
  );
};

export default LoungeExperience;
