import type { IncomingMessage, ServerResponse } from "node:http";
import { ensureSchema, getPool } from "./_lib/db.js";
import { getStripe } from "./_lib/stripe.js";
import { sendJson } from "./_lib/http.js";

const priceMap: Record<string, number> = {
  individual: 1999,
  company_small: 2999,
  company_medium: 3999,
  company_large: 4999,
};

/**
 * Stripe Webhook handler.
 * For Vercel: raw body is available via req body.
 * For local Express: needs express.raw() middleware on this route.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const pool = getPool();
    const stripe = getStripe();

    // Read raw body
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const rawBody = Buffer.concat(chunks).toString("utf8");

    let event;
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (webhookSecret && sig) {
      // Verify signature if webhook secret is configured
      event = stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
    } else {
      // If no webhook secret, parse the event directly (less secure, but works in dev)
      event = JSON.parse(rawBody);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const planType = session.metadata?.planType || "individual";
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          // Upsert subscription record
          await pool.query(
            `insert into subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan_type, price_amount, status, current_period_end, updated_at)
             values ($1, $2, $3, $4, $5, 'active', now() + interval '30 days', now())
             on conflict (user_id) do update set
               stripe_customer_id = excluded.stripe_customer_id,
               stripe_subscription_id = excluded.stripe_subscription_id,
               plan_type = excluded.plan_type,
               price_amount = excluded.price_amount,
               status = 'active',
               current_period_end = excluded.current_period_end,
               updated_at = now()`,
            [
              userId,
              customerId,
              subscriptionId,
              planType,
              planType === "individual" ? 1999
                : planType === "company_small" ? 2999
                : planType === "company_medium" ? 3999
                : 4999,
            ]
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const subscriptionId = sub.id;
        const planType = sub.metadata?.planType;
        const status = sub.status === "active" ? "active"
          : sub.status === "past_due" ? "past_due"
          : sub.status === "canceled" ? "cancelled"
          : sub.status;
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        if (planType && priceMap[planType]) {
          await pool.query(
            `update subscriptions
             set status=$1, current_period_end=$2, plan_type=$3, price_amount=$4, updated_at=now()
             where stripe_subscription_id=$5`,
            [status, periodEnd, planType, priceMap[planType], subscriptionId]
          );
        } else {
          await pool.query(
            `update subscriptions set status=$1, current_period_end=$2, updated_at=now()
             where stripe_subscription_id=$3`,
            [status, periodEnd, subscriptionId]
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        await pool.query(
          `update subscriptions set status='cancelled', updated_at=now()
           where stripe_subscription_id=$1`,
          [sub.id]
        );
        break;
      }

      default:
        // Unhandled event type — that's fine
        break;
    }

    return sendJson(res, 200, { received: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("Webhook error:", message);
    return sendJson(res, 400, { error: "Webhook error", details: message });
  }
}
