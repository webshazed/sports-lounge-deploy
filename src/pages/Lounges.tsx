import Header from "@/components/Header";
import { MapPin, Clock, Phone, ArrowRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const MOCK_LOUNGES = [
  {
    id: "mayfair",
    name: "Mayfair Flagship",
    city: "London",
    country: "UK",
    address: "14 Berkeley Square, Mayfair, London W1J 6BQ",
    hours: "11:00 AM - 2:00 AM (Daily)",
    phone: "+44 20 7499 0000",
    image: "https://images.unsplash.com/photo-1542314831-c6a4d14294ca?auto=format&fit=crop&q=80&w=2600",
    features: ["Private Screening Rooms", "Cigar Terrace", "Fine Dining", "Sommelier Service"],
    rating: 5.0
  },
  {
    id: "downtown-dubai",
    name: "Downtown Oasis",
    city: "Dubai",
    country: "UAE",
    address: "Boulevard Plaza, Downtown Dubai",
    hours: "12:00 PM - 3:00 AM (Daily)",
    phone: "+971 4 456 7890",
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2600",
    features: ["Rooftop Viewing", "Shisha Lounge", "Valet Parking", "VIP Pods"],
    rating: 4.9
  },
  {
    id: "manhattan",
    name: "Manhattan Club",
    city: "New York",
    country: "USA",
    address: "432 Park Avenue, New York, NY 10022",
    hours: "4:00 PM - 4:00 AM (Tue-Sun)",
    phone: "+1 212 555 0199",
    image: "https://images.unsplash.com/photo-1574096079513-d8259312b78a?auto=format&fit=crop&q=80&w=2600",
    features: ["Executive Suites", "Craft Cocktails", "VR Golf Simulator", "Live DJ"],
    rating: 4.8
  }
];

export default function Lounges() {
  const navigate = useNavigate();

  return (
    <div className="theme-light min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 pb-20">
        <div className="rounded-3xl bg-slate-900 border border-border p-8 md:p-12 mb-10 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e346b]/40 via-[#d4af37]/10 to-transparent pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-4">
              Our Locations
            </h1>
            <p className="text-lg text-white/80 md:leading-relaxed">
              Experience the pinnacle of sports entertainment in our exclusive, globally situated lounges. Exceptional service and unparalleled atmosphere await.
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 md:grid-cols-2">
          {MOCK_LOUNGES.map((lounge) => (
            <div key={lounge.id} className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="aspect-[4/3] relative overflow-hidden">
                <img 
                  src={lounge.image} 
                  alt={lounge.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-12">
                  <div className="flex items-center gap-2 mb-1 text-white">
                    <MapPin className="h-4 w-4 text-[#d4af37]" />
                    <span className="text-sm font-medium tracking-wide">{lounge.city}, {lounge.country}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">{lounge.name}</h2>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-3 text-sm text-foreground/80">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{lounge.address}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-foreground/80">
                    <Clock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{lounge.hours}</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-foreground/80">
                    <Phone className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <span>{lounge.phone}</span>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-2">Premium Features</div>
                  <div className="flex flex-wrap gap-2">
                    {lounge.features.map(f => (
                      <span key={f} className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-[11px] font-medium text-muted-foreground">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => navigate("/lounge/book")}
                    className="flex-1 btn-primary text-sm py-2.5"
                  >
                    Book Table
                  </button>
                  <button 
                    className="flex-1 border border-border rounded-lg text-sm font-semibold hover:bg-background transition-colors"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

