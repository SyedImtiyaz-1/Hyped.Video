import { Check, Info, Receipt } from "lucide-react";
import { PACKS, type PackKey } from "@launchreel/core";
import { CreditTable } from "@/components/credit-table";
import { PackCards, PriceNote, RECOMMENDED } from "@/components/pricing/pack-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { PageBody, PageHeader, SectionTitle } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { visitorCurrency } from "@/lib/region";
import { studioAvailable } from "@/lib/studio";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

const PERKS = ["Pay once, no subscription", "Failed renders refunded", "Secure checkout by Dodo Payments"];

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ pack?: string; demo?: string; paid?: string; currency?: string }> }) {
  const params = await searchParams;
  const user = await requireUser();
  // The pricing page links here with ?pack=… to highlight the pack the visitor picked.
  const picked = params.pack && params.pack in PACKS ? (params.pack as PackKey) : RECOMMENDED;
  const [currency, studio] = await Promise.all([visitorCurrency(params.currency), studioAvailable()]);

  return (
    <>
      <PageHeader title="Billing" description="Buy credits when you need them: no subscription, and credits never expire. Payments are handled by Dodo Payments, our merchant of record." />
      <PageBody className="space-y-8">
        {params.demo && <Notice>Demo mode: checkout and the billing portal are disabled.</Notice>}
        {params.paid && <Notice tone="success">Payment received. Your credits appear here within a few seconds.</Notice>}

        <Card>
          <CardHeader title="Your credits" />
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-[13px] text-gray-900">Credits left</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{user.credits}</p>
            </div>
            <div>
              <p className="text-[13px] text-gray-900">Enough for</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{plural(user.credits, "short video")}</p>
            </div>
          </CardContent>
          <CardFooter>
            <span className="flex items-center gap-2">
              <Receipt className="size-4" />
              Invoices and receipts live in the billing portal.
            </span>
            {user.billingCustomerId ? (
              <form action="/api/billing/portal" method="post">
                <Button size="sm">Open billing portal</Button>
              </form>
            ) : (
              <span className="text-[13px]">Available after your first purchase</span>
            )}
          </CardFooter>
        </Card>

        <section>
          <SectionTitle>Buy credits</SectionTitle>
          <PackCards currency={currency} checkout highlight={picked} />
          <PriceNote currency={currency} className="mt-3" />
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-900">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-gray-1000" />
                {perk}
              </li>
            ))}
          </ul>
        </section>

        <Card>
          <CardHeader title="How credits work" description="1 credit makes one Standard video up to 30 seconds. A revision costs half, rounded up." />
          <CardContent>
            <CreditTable studioSoon={!studio} />
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "success" }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border px-4 py-3 text-sm", tone === "success" ? "border-green-400 bg-green-100 text-green-900" : "border-blue-400 bg-blue-100 text-blue-900")}>
      {tone === "success" ? <Check className="size-4" /> : <Info className="size-4" />}
      {children}
    </div>
  );
}
