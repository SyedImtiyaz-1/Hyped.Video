import { INDIA_GST, INR_PER_USD_ESTIMATE, PACKS, unitEconomics, type PackKey } from "@launchreel/core";
import { purchasedPacks } from "@/lib/ledger";
import { getDb } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/ui/page";
import { StatusDot } from "@/components/ui/status";
import { isDemo } from "@/lib/demo";
import { hostOf } from "@/lib/format";
import { isAdmin, requireUser } from "@/lib/user";
import { Stat } from "../stat";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

// Unit economics from real, metered jobs. This is the page that tells you if pricing is profitable.
export default async function Admin() {
  if (isDemo) redirect("/dashboard");
  const user = await requireUser();
  if (!isAdmin(user.id)) notFound();

  const db = await getDb();
  const since = new Date(Date.now() - 30 * 86400_000);
  const jobs = await db.job.findMany({ where: { finishedAt: { gte: since } }, orderBy: { finishedAt: "desc" }, take: 500 });
  const done = jobs.filter((j) => j.status === "SUCCEEDED");
  const failed = jobs.filter((j) => j.status === "FAILED");
  const totalCogs = jobs.reduce((a, j) => a + unitEconomics(j).total, 0); // failed jobs still cost tokens
  const perVideo = done.length ? totalCogs / done.length : 0;
  const avg = (f: (j: (typeof jobs)[number]) => number | null) => (done.length ? done.reduce((a, j) => a + (f(j) ?? 0), 0) / done.length : 0);
  const p90 = done.map((j) => unitEconomics(j).total).sort((a, b) => a - b)[Math.floor(done.length * 0.9)] ?? 0;
  // Pack revenue by currency: the ledger records the packs, plus "@INR" for rupees ("purchase:CREATOR@INR").
  const purchases = await db.creditEntry.findMany({ where: { reason: { startsWith: "purchase:" }, createdAt: { gte: since } }, select: { reason: true } });
  const revenue = { usd: 0, inr: 0 };
  for (const p of purchases) {
    const { keys, currency } = purchasedPacks(p.reason.slice("purchase:".length));
    for (const k of keys) {
      if (currency === "INR") revenue.inr += PACKS[k].priceInr;
      else revenue.usd += PACKS[k].priceUsd;
    }
  }
  // What one credit costs us: 30-day cost over the credits that delivered videos used.
  const creditsUsed = done.reduce((a, j) => a + j.creditsCost, 0);
  const costPerCredit = creditsUsed ? totalCogs / creditsUsed : 0;

  return (
    <>
      <PageHeader title="Unit economics" description="Last 30 days, from metered jobs. Failed renders count toward cost." />
      <PageBody className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Videos delivered" value={done.length} />
          <Stat label="Failure rate" value={`${jobs.length ? Math.round((failed.length / jobs.length) * 100) : 0}%`} />
          <Stat label="Cost per delivered video" value={`$${perVideo.toFixed(2)}`} hint={`p90 $${p90.toFixed(2)}`} />
          <Stat label="Pack revenue" value={`$${revenue.usd}`} hint={`${revenue.inr ? `+ ₹${revenue.inr.toLocaleString("en-IN")} · ` : ""}30-day cost $${totalCogs.toFixed(0)}`} />
          <Stat label="Avg. turns" value={avg((j) => j.numTurns).toFixed(0)} />
          <Stat label="Avg. output tokens" value={`${(avg((j) => j.outputTokens) / 1000).toFixed(0)}k`} />
          <Stat label="Avg. cache reads" value={`${(avg((j) => j.cacheReadTokens) / 1e6).toFixed(2)}M`} />
        </div>

        <Card className="overflow-hidden">
          <CardHeader title="Margin by credit pack at current cost" description={`One credit costs us $${costPerCredit.toFixed(2)} (30-day cost over credits used).`} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-alpha-400 bg-background-200 text-left text-xs text-gray-900">
                  {["Pack", "Credits", "USD price", "USD / credit", "USD margin", "India price", "India / credit", "India margin"].map((h) => (
                    <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-alpha-400">
                {(Object.keys(PACKS) as PackKey[]).map((key) => {
                  const pack = PACKS[key];
                  const usd = pack.priceUsd / pack.credits;
                  // Rupee prices include GST; what's left, in dollars at an estimated rate.
                  const inr = pack.priceInr / (1 + INDIA_GST) / INR_PER_USD_ESTIMATE / pack.credits;
                  const margin = (rev: number) => (costPerCredit ? `${Math.round((1 - costPerCredit / rev) * 100)}%` : "—");
                  return (
                    <tr key={key}>
                      <td className="px-5 py-3">{pack.name}</td>
                      <td className="px-5 py-3 tabular-nums">{pack.credits}</td>
                      <td className="px-5 py-3 tabular-nums">${pack.priceUsd}</td>
                      <td className="px-5 py-3 tabular-nums">${usd.toFixed(2)}</td>
                      <td className="px-5 py-3 tabular-nums">{margin(usd)}</td>
                      <td className="px-5 py-3 tabular-nums">₹{pack.priceInr.toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3 tabular-nums">${inr.toFixed(2)}</td>
                      <td className="px-5 py-3 tabular-nums">{margin(inr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Recent jobs" />
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-gray-alpha-400 bg-background-200 text-left text-xs text-gray-900">
                  {["Status", "Source", "Model", "Turns", "Output", "Cache read", "LLM $", "Minutes", "Total $"].map((h) => (
                    <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-alpha-400 font-mono text-[13px]">
                {jobs.slice(0, 100).map((j) => (
                  <tr key={j.id}>
                    <td className="px-5 py-2.5 font-sans"><StatusDot status={j.status} /></td>
                    <td className="px-5 py-2.5 font-sans">{hostOf(j.sourceUrl)}</td>
                    <td className="px-5 py-2.5">{j.model}</td>
                    <td className="px-5 py-2.5">{j.numTurns}</td>
                    <td className="px-5 py-2.5">{j.outputTokens}</td>
                    <td className="px-5 py-2.5">{j.cacheReadTokens}</td>
                    <td className="px-5 py-2.5">{j.llmCostUsd?.toFixed(2)}</td>
                    <td className="px-5 py-2.5">{((j.computeSeconds ?? 0) / 60).toFixed(1)}</td>
                    <td className="px-5 py-2.5">{unitEconomics(j).total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
