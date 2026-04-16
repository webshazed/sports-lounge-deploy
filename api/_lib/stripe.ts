import Stripe from "stripe";

let stripeInstance: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("Missing STRIPE_SECRET_KEY env var");
    stripeInstance = new Stripe(key, { apiVersion: "2025-04-30.basil" });
  }
  return stripeInstance;
}

/** Plan configurations matching the membership tiers */
export const PLANS = {
  individual: {
    name: "Individual Membership",
    price: 1999, // £19.99 in pence
    interval: "month" as const,
    description: "Individual Membership — Monthly",
  },
  company_small: {
    name: "Company Membership — Small",
    price: 2999, // £29.99
    interval: "month" as const,
    description: "Small — Under 10 Staff",
  },
  company_medium: {
    name: "Company Membership — Medium",
    price: 3999, // £39.99
    interval: "month" as const,
    description: "Medium — 11-20 Staff",
  },
  company_large: {
    name: "Company Membership — Large",
    price: 4999, // £49.99
    interval: "month" as const,
    description: "Large — Over 20+ Staff",
  },
} as const;

export type PlanType = keyof typeof PLANS;
