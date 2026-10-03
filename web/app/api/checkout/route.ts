import { NextResponse } from "next/server";
import { PACKS, REEL_PACKS, type PackKey, type ReelPackKey } from "@launchreel/core";
import { requireUser } from "@/lib/user";
import { isDemo } from "@/lib/demo";
import { dodo, productIdFor } from "@/lib/dodo";
import { visitorCurrency } from "@/lib/region";

export async function POST(req: Request) {
  if (isDemo) return NextResponse.redirect(new URL("/dashboard/billing?demo=1", req.url), 303);
  const user = await requireUser();
  const form = await req.formData();
  const item = String(form.get("item"));
  const key = item in PACKS || item in REEL_PACKS ? (item as PackKey | ReelPackKey) : undefined;
  const productId = key && productIdFor(key);
  if (!key || !productId) return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
  const app = process.env.NEXT_PUBLIC_APP_URL;
  // Buyers in India pay the rupee price, and Dodo offers UPI only when the session says so: billing country India,
  // billing currency rupees (docs.dodopayments.com/features/payment-methods/india). Everyone else as before.
  // The visitor's country decides (a form field could ask for rupees from anywhere); `next dev` has no country header,
  // so there the form may say.
  const india = (await visitorCurrency(process.env.NODE_ENV === "development" ? String(form.get("currency") ?? "") : undefined)) === "inr";

  const session = await dodo().checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: user.billingCustomerId
      ? { customer_id: user.billingCustomerId }
      : user.email
        ? { email: user.email }
        : undefined,
    metadata: { userId: user.id, item: key }, // the webhook uses userId to credit the right account
    feature_flags: { allow_discount_code: true, allow_customer_editing_email: false },
    ...(india ? { billing_currency: "INR" as const, billing_address: { country: "IN" as const }, allowed_payment_method_types: ["upi_intent" as const, "credit" as const, "debit" as const, "apple_pay" as const] } : {}),
    return_url: `${app}/dashboard/billing?paid=1${key in REEL_PACKS ? "#reels" : ""}`,
    cancel_url: `${app}/dashboard/billing`,
  });
  if (!session.checkout_url) return NextResponse.json({ error: "Checkout unavailable" }, { status: 502 });
  return NextResponse.redirect(session.checkout_url, 303);
}
