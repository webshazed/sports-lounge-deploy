import { motion } from "framer-motion";
import { Calendar, MapPin, ArrowRight } from "lucide-react";

const events = [
  {
    title: "Sports Business Networking Night",
    date: "March 28, 2026",
    location: "London Lounge",
    category: "Networking",
  },
  {
    title: "Champions League Live Viewing",
    date: "April 5, 2026",
    location: "Manchester Lounge",
    category: "Live Sport",
  },
  {
    title: "Guest Speaker Series",
    date: "April 12, 2026",
    location: "Chester Lounge",
    category: "Speaker",
  },
  {
    title: "Members Golf Day",
    date: "April 20, 2026",
    location: "Cheshire Golf Club",
    category: "Social",
  },
];

const UpcomingEvents = () => {
  return (
    <section id="events" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="section-label section-label-with-lines mb-4">What{"'"}s On</p>
          <h2 className="font-body text-4xl font-bold text-foreground">Upcoming Events</h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {events.map((event, i) => (
            <motion.div
              key={event.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="event-card group cursor-pointer"
            >
              <div className="p-6">
                <span className="text-xs font-semibold tracking-wider uppercase text-primary mb-3 block">
                  {event.category}
                </span>
                <h3 className="font-display text-lg font-bold text-foreground mb-4 group-hover:text-primary transition-colors">
                  {event.title}
                </h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{event.location}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <a href="#" className="btn-secondary inline-flex items-center gap-2">
            View All Events
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
};

export default UpcomingEvents;
