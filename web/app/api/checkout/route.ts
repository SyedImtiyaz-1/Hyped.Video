import { NextResponse } from "next/server";
import { PACKS, type PackKey } from "@launchreel/core";
import { requireUser } from "@/lib/user";
import { isDemo } from "@/lib/demo";
import { dodo, productIdFor } from "@/lib/dodo";

export async function POST(req: Request) {
  if (isDemo) return NextResponse.redirect(new URL("/dashboard/billing?demo=1", req.url), 303);
  const user = await requireUser();
  const item = String((await req.formData()).get("item"));
  const key = item in PACKS ? (item as PackKey) : undefined;
  const productId = key && productIdFor(key);
  if (!key || !productId) return NextResponse.json({ error: "Unknown credit pack" }, { status: 400 });
  const app = process.env.NEXT_PUBLIC_APP_URL;

  const session = await dodo().checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: user.billingCustomerId
      ? { customer_id: user.billingCustomerId }
      : user.email
        ? { email: user.email }
        : undefined,
    metadata: { userId: user.id, item: key }, // the webhook uses userId to credit the right account
    feature_flags: { allow_discount_code: true, allow_customer_editing_email: false },
    return_url: `${app}/dashboard/billing?paid=1`,
    cancel_url: `${app}/dashboard/billing`,
  });
  if (!session.checkout_url) return NextResponse.json({ error: "Checkout unavailable" }, { status: 502 });
  return NextResponse.redirect(session.checkout_url, 303);
}
