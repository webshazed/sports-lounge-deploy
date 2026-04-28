import type { IncomingMessage, ServerResponse } from "node:http";
import { getSessionFromAuthHeader } from "./_lib/session.js";
import { ensureSchema, getPool } from "./_lib/db.js";
import { getStripe, PLANS, type PlanType } from "./_lib/stripe.js";
import { allowMethods, readJson, sendJson } from "./_lib/http.js";

type CheckoutBody = { planType?: string };

function normalizeSubscriptionStatus(status: string) {
  if (status === "active") return "active";
  if (status === "past_due") return "past_due";
  if (status === "canceled") return "cancelled";
  return status;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    allowMethods(res, ["POST"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.headers.authorization);
    const pool = getPool();
    const body = await readJson<CheckoutBody>(req);
    const planType = (body.planType || "individual") as PlanType;

    if (!PLANS[planType]) {
      return sendJson(res, 400, { error: "Invalid plan type" });
    }

    const plan = PLANS[planType];
    const stripe = getStripe();

    // Get user email
    const userRes = await pool.query(`select email from users where id=$1`, [session.userId]);
    const email = userRes.rows[0]?.email;

    // Create or reuse Stripe Customer
    let customerId: string | undefined;
    const subRes = await pool.query(
      `select stripe_customer_id from subscriptions where user_id=$1 and stripe_customer_id is not null limit 1`,
      [session.userId]
    );
    if (subRes.rows[0]?.stripe_customer_id) {
      customerId = subRes.rows[0].stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId: String(session.userId) },
      });
      customerId = customer.id;
    }

    const existingSubRes = await pool.query(
      `select plan_type, status, stripe_customer_id, stripe_subscription_id
       from subscriptions
       where user_id=$1
       order by created_at desc
       limit 1`,
      [session.userId]
    );
    const existingSub = existingSubRes.rows[0];

    if (existingSub?.status === "active" && existingSub?.stripe_subscription_id) {
      if (existingSub.plan_type === planType) {
        return sendJson(res, 200, {
          unchanged: true,
          message: `Your ${plan.name} is already active.`,
          planType,
        });
      }

      const stripeSubscription = await stripe.subscriptions.retrieve(existingSub.stripe_subscription_id);
      const itemId = stripeSubscription.items.data[0]?.id;
      if (!itemId) {
        throw new Error("Current subscription is missing billable items");
      }

      const price = await stripe.prices.create({
        currency: "gbp",
        unit_amount: plan.price,
        recurring: { interval: plan.interval },
        product_data: {
          name: plan.name,
          description: plan.description,
        },
      });

      const updatedSubscription = await stripe.subscriptions.update(existingSub.stripe_subscription_id, {
        items: [{ id: itemId, price: price.id }],
        proration_behavior: "create_prorations",
        metadata: {
          userId: String(session.userId),
          planType,
        },
      });

      await pool.query(
        `update subscriptions
         set stripe_customer_id=$1,
             stripe_subscription_id=$2,
             plan_type=$3,
             price_amount=$4,
             status=$5,
             current_period_end=$6,
             updated_at=now()
         where user_id=$7`,
        [
          typeof updatedSubscription.customer === "string" ? updatedSubscription.customer : customerId,
          updatedSubscription.id,
          planType,
          plan.price,
          normalizeSubscriptionStatus(updatedSubscription.status),
          updatedSubscription.current_period_end
            ? new Date(updatedSubscription.current_period_end * 1000).toISOString()
            : null,
          session.userId,
        ]
      );

      return sendJson(res, 200, {
        upgraded: true,
        message: `Membership updated to ${plan.name}.`,
        planType,
      });
    }

    // Determine success/cancel URLs
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "") || "http://localhost:5173";

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: plan.name,
              description: plan.description,
            },
            unit_amount: plan.price,
            recurring: { interval: plan.interval },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: String(session.userId),
        planType,
      },
      success_url: `${origin}/membership?status=success`,
      cancel_url: `${origin}/membership?status=cancelled`,
    });

    return sendJson(res, 200, { sessionUrl: checkoutSession.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}
