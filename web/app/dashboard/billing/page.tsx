import { Check, Info, Receipt } from "lucide-react";
import { CREDIT_COST, PACK_1, PLANS, type PlanId } from "@launchreel/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { PageBody, PageHeader, SectionTitle } from "@/components/ui/page";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

const PAID: Exclude<PlanId, "FREE">[] = ["STARTER", "PRO", "AGENCY"];

const PERKS: Record<Exclude<PlanId, "FREE">, string[]> = {
  STARTER: ["No watermark", "All tones and formats", "Revisions for 1 credit"],
  PRO: ["Priority rendering", "Brand kit (soon)", "GitHub release videos (soon)"],
  AGENCY: ["Top-priority rendering", "White-label share pages (soon)", "Client workspaces and API (soon)"],
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ plan?: string; demo?: string; paid?: string }> }) {
  const params = await searchParams;
  const user = await requireUser();
  const current = PLANS[user.plan];

  return (
    <>
      <PageHeader title="Billing" description="Plans, credits and invoices. Payments are handled by Dodo Payments, our merchant of record." />
      <PageBody className="space-y-8">
        {params.demo && (
          <Notice>Demo mode: checkout and the billing portal are disabled.</Notice>
        )}
        {params.paid && <Notice tone="success">Payment received. Your credits appear here within a few seconds.</Notice>}

        <Card>
          <CardHeader title="Current plan" actions={<Badge tone={user.plan === "FREE" ? "gray" : "blue"} size="md">{current.name}</Badge>} />
          <CardContent className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="text-[13px] text-gray-900">Price</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{current.priceUsd ? `$${current.priceUsd}/month` : "Free"}</p>
            </div>
            <div>
              <p className="text-[13px] text-gray-900">Included each month</p>
              <p className="mt-1 text-xl font-semibold tracking-tight">{current.creditsPerMonth ? `${current.creditsPerMonth} credits` : "1 trial video"}</p>
            </div>
            <div>
              <p className="text-[13px] text-gray-900">Credits left</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{user.credits}</p>
              <Progress className="mt-2" value={user.credits / Math.max(current.creditsPerMonth, user.credits, 1)} />
            </div>
          </CardContent>
          <CardFooter>
            <span className="flex items-center gap-2">
              <Receipt className="size-4" />
              Invoices, payment method and cancellation live in the billing portal.
            </span>
            {user.billingCustomerId ? (
              <form action="/api/billing/portal" method="post">
                <Button size="sm">Manage billing</Button>
              </form>
            ) : (
              <span className="text-[13px]">Available after your first purchase</span>
            )}
          </CardFooter>
        </Card>

        <section>
          <SectionTitle>Plans</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-3">
            {PAID.map((id) => {
              const plan = PLANS[id];
              const isCurrent = user.plan === id;
              const highlighted = params.plan === id && !isCurrent;
              return (
                <Card key={id} className={cn("flex flex-col", highlighted && "border-blue-700 ring-1 ring-blue-700", isCurrent && "border-gray-1000")}>
                  <CardContent className="flex flex-1 flex-col">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold">{plan.name}</h3>
                      {isCurrent && <Badge tone="inverted">Current</Badge>}
                    </div>
                    <p className="mt-3">
                      <span className="text-3xl font-semibold tracking-[-0.04em]">${plan.priceUsd}</span>
                      <span className="text-sm text-gray-900">/month</span>
                    </p>
                    <p className="mt-1 text-sm text-gray-900">
                      {plan.creditsPerMonth / CREDIT_COST.newVideo} videos a month · {plan.creditsPerMonth} credits
                    </p>
                    <ul className="mt-5 flex-1 space-y-2 text-sm">
                      {PERKS[id].map((perk) => (
                        <li key={perk} className="flex items-center gap-2">
                          <Check className="size-4 shrink-0" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                    <form action="/api/checkout" method="post" className="mt-6">
                      <input type="hidden" name="item" value={id} />
                      <Button variant={highlighted || (!isCurrent && id === "PRO") ? "primary" : "secondary"} className="w-full" disabled={isCurrent}>
                        {isCurrent ? "Current plan" : user.billingSubscriptionId ? `Switch to ${plan.name}` : `Choose ${plan.name}`}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <Card>
          <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold">Just one video</h3>
              <p className="mt-1 text-sm text-gray-900">
                ${PACK_1.priceUsd} for {PACK_1.credits} credits, enough for one new video. No subscription.
              </p>
            </div>
            <form action="/api/checkout" method="post">
              <input type="hidden" name="item" value="PACK_1" />
              <Button>Buy one video</Button>
            </form>
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
