import { NextResponse } from "next/server";
import { PLANS, PRODUCTS, grantCredits, revokeCredits, type Db } from "@launchreel/core";
import { getDb } from "@/lib/db";
import { dodo, planFor, productKeyFor } from "@/lib/dodo";

type DodoEvent = ReturnType<ReturnType<typeof dodo>["webhooks"]["unwrap"]>;

// Subscribe the Dodo webhook to: payment.succeeded, subscription.active, subscription.renewed,
// subscription.plan_changed, subscription.cancelled, subscription.expired, subscription.failed,
// refund.succeeded, dispute.opened, dispute.won.
// Every grant is keyed so retries and duplicate events never double-credit.
export async function POST(req: Request) {
  const body = await req.text();
  let event: DodoEvent;
  try {
    event = dodo().webhooks.unwrap(body, { headers: Object.fromEntries(req.headers) }); // Standard Webhooks signature check
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }
  const webhookId = req.headers.get("webhook-id") ?? event.timestamp;
  const db = await getDb();

  switch (event.type) {
    // One-time purchases. Subscription charges also emit this event, but plan credits come from
    // subscription.active / subscription.renewed below.
    case "payment.succeeded": {
      const p = event.data;
      if (p.subscription_id || p.subscription_ids.length) break;
      const userId = await resolveUser(db, p.metadata, p.customer);
      if (!userId) break;
      const lines = p.product_cart ?? [];
      const credits = lines.reduce((sum, line) => {
        const key = productKeyFor(line.product_id);
        const product = key ? PRODUCTS[key] : undefined;
        return sum + (product?.kind === "one_time" ? product.credits * line.quantity : 0);
      }, 0);
      await grantCredits(db, userId, credits, `purchase:${lines.map((l) => productKeyFor(l.product_id) ?? l.product_id).join("+")}`, `pay:${p.payment_id}`);
      break;
    }

    // First charge and every renewal: one month of credits per paid period.
    case "subscription.active":
    case "subscription.renewed": {
      const sub = event.data;
      if (event.type === "subscription.active" && sub.trial_period_days > 0) break; // nothing paid yet
      const plan = planFor(sub.product_id);
      const userId = plan && (await resolveUser(db, sub.metadata, sub.customer));
      if (!plan || !userId) break;
      await db.user.update({ where: { id: userId }, data: { plan, billingSubscriptionId: sub.subscription_id } });
      await grantCredits(db, userId, PLANS[plan].creditsPerMonth, `subscription:${plan}`, `sub:${sub.subscription_id}:${sub.next_billing_date}`);
      break;
    }

    // Upgrade mid-cycle: top up the difference for the rest of the period. Downgrades take effect at renewal.
    case "subscription.plan_changed": {
      const sub = event.data;
      const plan = planFor(sub.product_id);
      const userId = plan && (await resolveUser(db, sub.metadata, sub.customer));
      if (!plan || !userId) break;
      const before = await db.user.findUniqueOrThrow({ where: { id: userId } });
      await db.user.update({ where: { id: userId }, data: { plan, billingSubscriptionId: sub.subscription_id } });
      const periodLeft = Math.min(1, Math.max(0, new Date(sub.next_billing_date).getTime() - Date.now()) / (30 * 86400_000));
      const extra = Math.ceil((PLANS[plan].creditsPerMonth - PLANS[before.plan].creditsPerMonth) * periodLeft);
      await grantCredits(db, userId, extra, `upgrade:${plan}`, `planchange:${webhookId}`);
      break;
    }

    // Plan ends. Credits already granted stay: they were paid for.
    case "subscription.cancelled":
    case "subscription.expired":
    case "subscription.failed": {
      const sub = event.data;
      if (sub.status === "active") break; // cancellation scheduled for the end of the period
      await db.user.updateMany({ where: { billingSubscriptionId: sub.subscription_id }, data: { plan: "FREE", billingSubscriptionId: null } });
      break;
    }

    // Money went back to the customer: take back unspent credits from that payment.
    case "refund.succeeded": {
      if (event.data.is_partial) break; // partial refunds are goodwill; keep credits
      await revokeForPayment(db, event.data.payment_id, `refund:${event.data.refund_id}`);
      break;
    }
    case "dispute.opened": {
      await revokeForPayment(db, event.data.payment_id, `dispute:${event.data.dispute_id}`);
      break;
    }
    case "dispute.won": {
      const revoked = await db.creditEntry.findUnique({ where: { paymentRef: `dispute:${event.data.dispute_id}` } });
      if (revoked && revoked.delta < 0) await grantCredits(db, revoked.userId, -revoked.delta, "dispute_won", `dispute-won:${event.data.dispute_id}`);
      break;
    }
  }
  return NextResponse.json({ received: true });
}

/** Match a Dodo customer to our user: checkout metadata first, then the stored customer id, then email. */
async function resolveUser(db: Db, metadata: Record<string, unknown> | null | undefined, customer: { customer_id: string; email: string }) {
  const metaId = typeof metadata?.userId === "string" ? metadata.userId : undefined;
  const user =
    (metaId && (await db.user.findUnique({ where: { id: metaId } }))) ||
    (await db.user.findUnique({ where: { billingCustomerId: customer.customer_id } })) ||
    (customer.email ? await db.user.findFirst({ where: { email: customer.email } }) : null);
  if (!user) {
    console.error(`[dodo] no user for customer ${customer.customer_id}; credits not granted`);
    return null;
  }
  if (!user.billingCustomerId) {
    await db.user.update({ where: { id: user.id }, data: { billingCustomerId: customer.customer_id } }).catch(() => {});
  }
  return user.id;
}

async function revokeForPayment(db: Db, paymentId: string, ref: string) {
  // One-time purchase: the ledger knows exactly what it granted.
  const grant = await db.creditEntry.findUnique({ where: { paymentRef: `pay:${paymentId}` } });
  if (grant) return revokeCredits(db, grant.userId, grant.delta, `revoke:${paymentId}`, ref);
  // Subscription charge: take back the latest monthly grant.
  const payment = await dodo().payments.retrieve(paymentId);
  const userId = await resolveUser(db, payment.metadata, payment.customer);
  if (!userId) return 0;
  const last = await db.creditEntry.findFirst({ where: { userId, reason: { startsWith: "subscription:" } }, orderBy: { createdAt: "desc" } });
  return last ? revokeCredits(db, userId, last.delta, `revoke:${paymentId}`, ref) : 0;
}
