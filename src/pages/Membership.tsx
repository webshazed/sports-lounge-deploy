import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { isAuthed } from "@/lib/auth";

type SubscriptionData = {
  subscription: {
    id: number;
    planType: string;
    priceAmount: number;
    status: string;
    currentPeriodEnd: string;
  } | null;
  regType: string;
};

const Membership = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [subData, setSubData] = useState<SubscriptionData | null>(null);

  useEffect(() => {
    if (!isAuthed()) {
      navigate("/signin", { replace: true });
      return;
    }

    const status = searchParams.get("status");
    if (status === "success") {
      toast.success("Payment successful! Your membership is now active.");
      // Clear the URL param
      window.history.replaceState({}, "", "/membership");
    } else if (status === "cancelled") {
      toast.info("Payment was cancelled. You can try again anytime.");
      window.history.replaceState({}, "", "/membership");
    }

    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const data = await apiFetch<SubscriptionData>("/api/subscription");
      setSubData(data);
      // If subscription is active, redirect to dashboard
      if (data.subscription?.status === "active") {
        navigate("/dashboard", { replace: true });
        return;
      }
    } catch {
      // Not critical — show the page anyway
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planType: string) => {
    setCheckoutLoading(planType);
    try {
      const data = await apiFetch<{ sessionUrl: string }>("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const regType = subData?.regType || localStorage.getItem("reg_type") || "individual";
  const isBusinessReg = regType === "business";

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="py-16 md:py-24 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-6 max-w-4xl relative z-10">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <p className="section-label section-label-with-lines mb-4">Membership</p>
            <h1 className="font-body text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Become a Member
            </h1>
            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              By becoming a member of our prestigious Sports Lounge. You gain entry to our exclusive
              networking portal and connect with like-minded individuals who share your passion.
            </p>
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mt-4 leading-relaxed">
              Elevate your social experience and be a part of a community that celebrates all things
              business and sports.
            </p>
          </motion.div>

          {/* Pricing Cards */}
          {!isBusinessReg ? (
            /* ─── Individual Membership ─── */
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex justify-center"
            >
              <div className="w-full max-w-md group">
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-card via-card to-card border border-border/60 shadow-2xl shadow-primary/5 hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1">
                  {/* Top gradient bar */}
                  <div className="h-1.5 bg-gradient-to-r from-[#3b5998] via-[#4a69a5] to-[#3b5998]" />

                  <div className="p-10 text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 bg-[#3b5998]/10 border border-[#3b5998]/20 rounded-full px-4 py-1.5 mb-6">
                      <div className="w-2 h-2 rounded-full bg-[#3b5998] animate-pulse" />
                      <span className="text-xs font-semibold tracking-wider text-[#3b5998] uppercase">Individual</span>
                    </div>

                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                      Individual Membership
                    </h2>

                    <div className="flex items-baseline justify-center gap-1 mb-2 mt-6">
                      <span className="text-5xl md:text-6xl font-extrabold text-foreground">£19.99</span>
                      <span className="text-muted-foreground text-lg">/Month</span>
                    </div>

                    <p className="text-muted-foreground text-sm mt-4 mb-8">
                      Full access to the exclusive networking portal
                    </p>

                    {/* Features */}
                    <div className="space-y-3 mb-10 text-left">
                      {[
                        "Exclusive networking portal access",
                        "Connect with like-minded members",
                        "Event invitations & RSVP",
                        "Live match watch parties",
                        "Business hub access",
                        "Direct messaging with members",
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleCheckout("individual")}
                      disabled={!!checkoutLoading}
                      className="w-full py-4 rounded-xl font-semibold text-base text-white bg-gradient-to-r from-[#3b5998] to-[#1e346b] hover:brightness-110 active:brightness-95 transition-all duration-200 shadow-lg shadow-[#3b5998]/25 hover:shadow-[#3b5998]/40 disabled:opacity-60"
                    >
                      {checkoutLoading === "individual" ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                          Processing...
                        </span>
                      ) : "Subscribe Now"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ─── Business / Company Membership ─── */
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-center mb-10"
              >
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Company Membership</h2>
                <p className="text-muted-foreground text-lg">Choose Your Plan</p>
              </motion.div>

              <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                {/* Small Plan */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <PricingCard
                    planType="company_small"
                    price="£29.99"
                    label="Small - Under 10 Staff"
                    isRecommended={false}
                    checkoutLoading={checkoutLoading}
                    onSelect={handleCheckout}
                  />
                </motion.div>

                {/* Medium Plan — Recommended */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <PricingCard
                    planType="company_medium"
                    price="£39.99"
                    label="Medium - 11-20 Staff"
                    isRecommended={true}
                    checkoutLoading={checkoutLoading}
                    onSelect={handleCheckout}
                  />
                </motion.div>

                {/* Large Plan */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <PricingCard
                    planType="company_large"
                    price="£49.99"
                    label="Large - Over 20+ Staff"
                    isRecommended={false}
                    checkoutLoading={checkoutLoading}
                    onSelect={handleCheckout}
                  />
                </motion.div>
              </div>
            </>
          )}

          {/* Security badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex items-center justify-center gap-2 mt-12 text-muted-foreground/60 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure payment powered by Stripe
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

/* ─── Pricing Card Component ─── */
function PricingCard({
  planType,
  price,
  label,
  isRecommended,
  checkoutLoading,
  onSelect,
}: {
  planType: string;
  price: string;
  label: string;
  isRecommended: boolean;
  checkoutLoading: string | null;
  onSelect: (plan: string) => void;
}) {
  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-card border shadow-xl transition-all duration-500 hover:-translate-y-2 ${
        isRecommended
          ? "border-[#3b5998] shadow-[#3b5998]/15 hover:shadow-[#3b5998]/25 scale-[1.02]"
          : "border-border/60 shadow-primary/5 hover:shadow-primary/10"
      }`}
    >
      {/* Top gradient bar */}
      <div
        className={`h-1.5 ${
          isRecommended
            ? "bg-gradient-to-r from-[#3b5998] via-[#6a8fd8] to-[#3b5998]"
            : "bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600"
        }`}
      />

      {isRecommended && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center gap-1 bg-[#3b5998] text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-[#3b5998]/30">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
            </svg>
            Recommended
          </span>
        </div>
      )}

      <div className="p-8 text-center">
        <div className="flex items-baseline justify-center gap-1 mb-2">
          <span className="text-4xl md:text-5xl font-extrabold text-foreground">{price}</span>
          <span className="text-muted-foreground text-base">/Month</span>
        </div>

        <p className="text-muted-foreground text-sm mt-3 mb-8 font-medium">{label}</p>

        {/* Features */}
        <div className="space-y-2.5 mb-8 text-left">
          {[
            "Networking portal access",
            "Team member accounts",
            "Business hub access",
            "Event & watch parties",
            "Priority support",
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </div>
          ))}
        </div>

        <button
          onClick={() => onSelect(planType)}
          disabled={!!checkoutLoading}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 ${
            isRecommended
              ? "text-white bg-gradient-to-r from-[#3b5998] to-[#1e346b] hover:brightness-110 shadow-lg shadow-[#3b5998]/25 hover:shadow-[#3b5998]/40"
              : "text-foreground bg-gradient-to-b from-card to-muted border border-border hover:border-[#3b5998]/40 hover:shadow-lg"
          }`}
        >
          {checkoutLoading === planType ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Processing...
            </span>
          ) : "Select Plan"}
        </button>
      </div>
    </div>
  );
}

export default Membership;
