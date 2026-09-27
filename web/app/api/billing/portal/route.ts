import { NextResponse } from "next/server";
import { requireUser } from "@/lib/user";
import { isDemo } from "@/lib/demo";
import { dodo } from "@/lib/dodo";

// Dodo's hosted customer portal: invoices, payment method, cancellation.
export async function POST(req: Request) {
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (isDemo) return NextResponse.redirect(new URL("/dashboard/billing?demo=1", req.url), 303);
  const user = await requireUser();
  if (!user.billingCustomerId) return NextResponse.redirect(`${app}/#pricing`, 303);
  const { link } = await dodo().customers.customerPortal.create(user.billingCustomerId, { return_url: `${app}/dashboard` });
  return NextResponse.redirect(link, 303);
}
