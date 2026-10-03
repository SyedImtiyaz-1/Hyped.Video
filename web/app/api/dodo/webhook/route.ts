import { NextResponse } from "next/server";
import { PACKS, REEL_PACKS, grantCredits, revokeCredits, type Db, type PackKey, type ReelPackKey } from "@launchreel/core";
import { getDb } from "@/lib/db";
import { dodo, packFor } from "@/lib/dodo";

type DodoEvent = ReturnType<ReturnType<typeof dodo>["webhooks"]["unwrap"]>;

// Subscribe the Dodo webhook to: payment.succeeded, refund.succeeded, dispute.opened, dispute.won.
// Credits come only from one-time packs (credit packs, and reel packs whose reel credits only make reels); there are
// no subscriptions.
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
    // A credit pack was paid for.
    case "payment.succeeded": {
      const p = event.data;
      if (p.subscription_id || p.subscription_ids.length) break; // we sell no subscriptions
      const userId = await resolveUser(db, p.metadata, p.customer);
      if (!userId) break;
      const lines = p.product_cart ?? [];
      let [credits, reels] = [0, 0];
      for (const line of lines) {
        const key = packFor(line.product_id);
        if (key && key in PACKS) credits += PACKS[key as PackKey].credits * line.quantity;
        else if (key && key in REEL_PACKS) reels += REEL_PACKS[key as ReelPackKey].reels * line.quantity;
      }
      // "purchase:CREATOR", with "@INR" when paid in rupees, so /admin can count revenue in the right currency.
      const packs = lines.map((l) => packFor(l.product_id) ?? l.product_id).join("+");
      const reason = `purchase:${packs}${p.currency && p.currency !== "USD" ? `@${p.currency}` : ""}`;
      await grantCredits(db, userId, credits, reason, `pay:${p.payment_id}`);
      await grantCredits(db, userId, reels, reason, `pay:${p.payment_id}:reels`, "reels");
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
      for (const balance of ["credits", "reels"] as const) {
        const tail = balance === "reels" ? ":reels" : "";
        const revoked = await db.creditEntry.findUnique({ where: { paymentRef: `dispute:${event.data.dispute_id}${tail}` } });
        if (revoked && revoked.delta < 0) await grantCredits(db, revoked.userId, -revoked.delta, "dispute_won", `dispute-won:${event.data.dispute_id}${tail}`, balance);
      }
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
  // The ledger knows exactly what that payment granted: credits, reel credits, or both.
  let revoked = 0;
  for (const balance of ["credits", "reels"] as const) {
    const tail = balance === "reels" ? ":reels" : "";
    const grant = await db.creditEntry.findUnique({ where: { paymentRef: `pay:${paymentId}${tail}` } });
    if (grant) revoked += await revokeCredits(db, grant.userId, grant.delta, `revoke:${paymentId}`, `${ref}${tail}`, balance);
  }
  return revoked;
}
