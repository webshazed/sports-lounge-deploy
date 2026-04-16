import type { IncomingMessage, ServerResponse } from "node:http";
import { getSessionFromAuthHeader } from "./_lib/session.js";
import { ensureSchema, getPool } from "./_lib/db.js";
import { allowMethods, sendJson } from "./_lib/http.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    allowMethods(res, ["GET"]);
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const session = getSessionFromAuthHeader(req.headers.authorization);
    const pool = getPool();

    const subRes = await pool.query(
      `select id, plan_type, price_amount, status, stripe_subscription_id, current_period_end, created_at
       from subscriptions
       where user_id = $1
       order by created_at desc
       limit 1`,
      [session.userId]
    );

    const sub = subRes.rows[0];
    if (!sub) {
      // Also fetch reg_type so frontend knows which plans to show
      const profRes = await pool.query(`select reg_type from profiles where user_id=$1`, [session.userId]);
      const regType = profRes.rows[0]?.reg_type || "individual";
      return sendJson(res, 200, { subscription: null, regType });
    }

    // Also fetch reg_type
    const profRes = await pool.query(`select reg_type from profiles where user_id=$1`, [session.userId]);
    const regType = profRes.rows[0]?.reg_type || "individual";

    return sendJson(res, 200, {
      subscription: {
        id: sub.id,
        planType: sub.plan_type,
        priceAmount: sub.price_amount,
        status: sub.status,
        stripeSubscriptionId: sub.stripe_subscription_id,
        currentPeriodEnd: sub.current_period_end,
        createdAt: sub.created_at,
      },
      regType,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "Unauthorized" || message.toLowerCase().includes("jwt")) {
      return sendJson(res, 401, { error: "Unauthorized" });
    }
    return sendJson(res, 500, { error: "Server error", details: message });
  }
}
