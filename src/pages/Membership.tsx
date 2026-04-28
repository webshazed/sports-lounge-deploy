import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
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

type CheckoutResponse = {
  sessionUrl?: string;
  upgraded?: boolean;
  unchanged?: boolean;
  message?: string;
  planType?: string;
};

const PLAN_LABELS: Record<string, string> = {
  individual: "Individual Membership",
  company_small: "Company Membership - Small",
  company_medium: "Company Membership - Medium",
  company_large: "Company Membership - Large",
};

const Membership = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authed = isAuthed();
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [subData, setSubData] = useState<SubscriptionData | null>(null);

  async function fetchSubscription() {
    try {
      const data = await apiFetch<SubscriptionData>("/api/subscription");
      setSubData(data);
    } catch {
      setSubData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      toast.success("Membership updated successfully.");
      window.history.replaceState({}, "", "/membership");
    } else if (status === "cancelled") {
      toast.info("Payment was cancelled. You can try again anytime.");
      window.history.replaceState({}, "", "/membership");
    }

    if (authed) {
      fetchSubscription();
      return;
    }

    setLoading(false);
  }, [authed, searchParams]);

  const handleCheckout = async (planType: string) => {
    if (!authed) {
      localStorage.setItem("reg_type", planType.startsWith("company_") ? "business" : "individual");
      toast.info("Create your account first, then you can continue with membership checkout.");
      navigate("/register");
      return;
    }

    setCheckoutLoading(planType);
    try {
      const data = await apiFetch<CheckoutResponse>("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });

      if (data.sessionUrl) {
        window.location.href = data.sessionUrl;
        return;
      }

      if (data.unchanged) {
        toast.info(data.message || "This is already your current membership plan.");
        return;
      }

      if (data.upgraded) {
        toast.success(data.message || "Membership updated successfully.");
        await fetchSubscription();
        return;
      }

      if (data.message) {
        toast.success(data.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const currentPlanType = subData?.subscription?.planType || "";
  const hasActiveSubscription = subData?.subscription?.status === "active";
  const currentPlanLabel = PLAN_LABELS[currentPlanType] || currentPlanType || "No active membership";
  const periodEndText = subData?.subscription?.currentPeriodEnd
    ? new Date(subData.subscription.currentPeriodEnd).toLocaleDateString()
    : null;

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

      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-20 right-1/4 h-96 w-96 rounded-full bg-blue-500/5 blur-3xl" />
        </div>

        <div className="container relative z-10 mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-16 text-center"
          >
            <p className="section-label section-label-with-lines mb-4">Membership</p>
            <h1 className="font-body mb-6 text-4xl font-bold text-foreground md:text-5xl lg:text-6xl">
              {hasActiveSubscription ? "Manage Membership" : "Become a Member"}
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
              Choose the membership plan that fits you best, keep track of your current subscription, and upgrade when you are ready.
            </p>
            {!authed && (
              <p className="mx-auto mt-6 max-w-2xl text-sm text-muted-foreground">
                Browse plans publicly, then create your account to complete membership.
              </p>
            )}
          </motion.div>

          {authed && subData?.subscription && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-12 rounded-[28px] border border-border/70 bg-card p-6 shadow-xl shadow-primary/5 md:p-8"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#3b5998]">
                    Current Membership
                  </p>
                  <h2 className="mt-3 text-3xl font-bold text-foreground">{currentPlanLabel}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Status: <span className="font-semibold text-foreground">{subData.subscription.status}</span>
                    {periodEndText ? ` · Current period ends ${periodEndText}` : ""}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#3b5998]/20 bg-[#3b5998]/10 px-5 py-4 text-sm text-white">
                  Use the options below to upgrade or change your plan from this page.
                </div>
              </div>
            </motion.div>
          )}

          <div className="space-y-16">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex justify-center"
            >
              <div className="w-full max-w-md group">
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-card shadow-2xl shadow-primary/5 transition-all duration-500 hover:-translate-y-1 hover:shadow-primary/10">
                  <div className="h-1.5 bg-gradient-to-r from-[#3b5998] via-[#4a69a5] to-[#3b5998]" />

                  <div className="p-10 text-center">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#3b5998]/20 bg-[#3b5998]/10 px-4 py-1.5">
                      <div className="h-2 w-2 rounded-full bg-[#3b5998] animate-pulse" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#3b5998]">Individual</span>
                    </div>

                    <h2 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">
                      Individual Membership
                    </h2>

                    <div className="mt-6 mb-2 flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-extrabold text-foreground md:text-6xl">GBP 19.99</span>
                      <span className="text-lg text-muted-foreground">/Month</span>
                    </div>

                    <p className="mb-8 mt-4 text-sm text-muted-foreground">
                      Full access to the exclusive networking portal
                    </p>

                    <div className="mb-10 space-y-3 text-left">
                      {[
                        "Exclusive networking portal access",
                        "Connect with like-minded members",
                        "Event invitations and RSVP",
                        "Live match watch parties",
                        "Business hub access",
                        "Direct messaging with members",
                      ].map((feature, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                          <svg className="h-5 w-5 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {feature}
                        </div>
                      ))}
                    </div>

                    <MembershipButton
                      planType="individual"
                      currentPlanType={currentPlanType}
                      hasActiveSubscription={hasActiveSubscription}
                      authed={authed}
                      checkoutLoading={checkoutLoading}
                      onSelect={handleCheckout}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            <div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mb-10 text-center"
              >
                <h2 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">Company Membership</h2>
                <p className="text-lg text-muted-foreground">Choose the right plan for your team</p>
              </motion.div>

              <div className="grid gap-6 md:grid-cols-3 lg:gap-8">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <PricingCard
                    planType="company_small"
                    price="GBP 29.99"
                    label="Small - Under 10 Staff"
                    isRecommended={false}
                    checkoutLoading={checkoutLoading}
                    authed={authed}
                    currentPlanType={currentPlanType}
                    hasActiveSubscription={hasActiveSubscription}
                    onSelect={handleCheckout}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <PricingCard
                    planType="company_medium"
                    price="GBP 39.99"
                    label="Medium - 11-20 Staff"
                    isRecommended={true}
                    checkoutLoading={checkoutLoading}
                    authed={authed}
                    currentPlanType={currentPlanType}
                    hasActiveSubscription={hasActiveSubscription}
                    onSelect={handleCheckout}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                >
                  <PricingCard
                    planType="company_large"
                    price="GBP 49.99"
                    label="Large - Over 20 Staff"
                    isRecommended={false}
                    checkoutLoading={checkoutLoading}
                    authed={authed}
                    currentPlanType={currentPlanType}
                    hasActiveSubscription={hasActiveSubscription}
                    onSelect={handleCheckout}
                  />
                </motion.div>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground/60"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

function MembershipButton({
  planType,
  currentPlanType,
  hasActiveSubscription,
  authed,
  checkoutLoading,
  onSelect,
}: {
  planType: string;
  currentPlanType: string;
  hasActiveSubscription: boolean;
  authed: boolean;
  checkoutLoading: string | null;
  onSelect: (plan: string) => void;
}) {
  const isCurrentPlan = hasActiveSubscription && currentPlanType === planType;
  const label = checkoutLoading === planType
    ? "Processing..."
    : !authed
      ? "Create Account to Join"
      : isCurrentPlan
        ? "Current Plan"
        : hasActiveSubscription
          ? "Upgrade / Change Plan"
          : "Subscribe Now";

  return (
    <button
      onClick={() => onSelect(planType)}
      disabled={!!checkoutLoading || isCurrentPlan}
      className="w-full rounded-xl bg-gradient-to-r from-[#3b5998] to-[#1e346b] py-4 text-base font-semibold text-white shadow-lg shadow-[#3b5998]/25 transition-all duration-200 hover:brightness-110 disabled:opacity-60"
    >
      {checkoutLoading === planType ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Processing...
        </span>
      ) : label}
    </button>
  );
}

function PricingCard({
  planType,
  price,
  label,
  isRecommended,
  checkoutLoading,
  authed,
  currentPlanType,
  hasActiveSubscription,
  onSelect,
}: {
  planType: string;
  price: string;
  label: string;
  isRecommended: boolean;
  checkoutLoading: string | null;
  authed: boolean;
  currentPlanType: string;
  hasActiveSubscription: boolean;
  onSelect: (plan: string) => void;
}) {
  const isCurrentPlan = hasActiveSubscription && currentPlanType === planType;
  const buttonLabel = checkoutLoading === planType
    ? "Processing..."
    : !authed
      ? "Create Account to Join"
      : isCurrentPlan
        ? "Current Plan"
        : hasActiveSubscription
          ? "Upgrade / Change Plan"
          : "Select Plan";

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-card border shadow-xl transition-all duration-500 hover:-translate-y-2 ${
        isRecommended
          ? "border-[#3b5998] shadow-[#3b5998]/15 hover:shadow-[#3b5998]/25 scale-[1.02]"
          : "border-border/60 shadow-primary/5 hover:shadow-primary/10"
      }`}
    >
      <div
        className={`h-1.5 ${
          isRecommended
            ? "bg-gradient-to-r from-[#3b5998] via-[#6a8fd8] to-[#3b5998]"
            : "bg-gradient-to-r from-gray-600 via-gray-500 to-gray-600"
        }`}
      />

      {isRecommended && (
        <div className="absolute top-4 right-4">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#3b5998] px-3 py-1 text-xs font-bold text-white shadow-lg shadow-[#3b5998]/30">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
            </svg>
            Recommended
          </span>
        </div>
      )}

      <div className="p-8 text-center">
        <div className="mb-2 flex items-baseline justify-center gap-1">
          <span className="text-4xl font-extrabold text-foreground md:text-5xl">{price}</span>
          <span className="text-base text-muted-foreground">/Month</span>
        </div>

        <p className="mb-8 mt-3 text-sm font-medium text-muted-foreground">{label}</p>

        <div className="mb-8 space-y-2.5 text-left">
          {[
            "Networking portal access",
            "Team member accounts",
            "Business hub access",
            "Event and watch parties",
            "Priority support",
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <svg className="h-4 w-4 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </div>
          ))}
        </div>

        <button
          onClick={() => onSelect(planType)}
          disabled={!!checkoutLoading || isCurrentPlan}
          className={`w-full rounded-xl py-3.5 text-sm font-semibold transition-all duration-200 disabled:opacity-60 ${
            isRecommended
              ? "bg-gradient-to-r from-[#3b5998] to-[#1e346b] text-white shadow-lg shadow-[#3b5998]/25 hover:brightness-110 hover:shadow-[#3b5998]/40"
              : "border border-border bg-gradient-to-b from-card to-muted text-foreground hover:border-[#3b5998]/40 hover:shadow-lg"
          }`}
        >
          {checkoutLoading === planType ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Processing...
            </span>
          ) : buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default Membership;
