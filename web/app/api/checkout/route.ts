import { NextResponse } from "next/server";
import { PRODUCTS, type ProductKey } from "@launchreel/core";
import { requireUser } from "@/lib/user";
import { isDemo } from "@/lib/demo";
import { dodo, productIdFor } from "@/lib/dodo";

export async function POST(req: Request) {
  if (isDemo) return NextResponse.redirect(new URL("/dashboard/billing?demo=1", req.url), 303);
  const user = await requireUser();
  const item = String((await req.formData()).get("item"));
  const key = item in PRODUCTS ? (item as ProductKey) : undefined;
  const productId = key && productIdFor(key);
  if (!key || !productId) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  const app = process.env.NEXT_PUBLIC_APP_URL;

  // Already subscribed: switch plans in place (Dodo prorates) instead of starting a second subscription.
  if (PRODUCTS[key].kind === "subscription" && user.billingSubscriptionId) {
    if (user.plan !== PRODUCTS[key].plan) {
      await dodo().subscriptions.changePlan(user.billingSubscriptionId, {
        product_id: productId,
        quantity: 1,
        proration_billing_mode: "prorated_immediately",
      });
    }
    return NextResponse.redirect(`${app}/dashboard?plan=changed`, 303);
  }

  const session = await dodo().checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: user.billingCustomerId
      ? { customer_id: user.billingCustomerId }
      : user.email
        ? { email: user.email }
        : undefined,
    metadata: { userId: user.id, item: key }, // the webhook uses userId to credit the right account
    feature_flags: { allow_discount_code: true, allow_customer_editing_email: false },
    return_url: `${app}/dashboard?paid=1`,
    cancel_url: `${app}/#pricing`,
  });
  if (!session.checkout_url) return NextResponse.json({ error: "Checkout unavailable" }, { status: 502 });
  return NextResponse.redirect(session.checkout_url, 303);
}
