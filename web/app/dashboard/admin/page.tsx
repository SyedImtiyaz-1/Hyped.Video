import { PLANS, unitEconomics } from "@launchreel/core";
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
  const users = await db.user.groupBy({ by: ["plan"], _count: true });
  const mrr = users.reduce((a, u) => a + PLANS[u.plan].priceUsd * u._count, 0);

  return (
    <>
      <PageHeader title="Unit economics" description="Last 30 days, from metered jobs. Failed renders count toward cost." />
      <PageBody className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Videos delivered" value={done.length} />
          <Stat label="Failure rate" value={`${jobs.length ? Math.round((failed.length / jobs.length) * 100) : 0}%`} />
          <Stat label="Cost per delivered video" value={`$${perVideo.toFixed(2)}`} hint={`p90 $${p90.toFixed(2)}`} />
          <Stat label="Subscription MRR" value={`$${mrr}`} hint={`30-day cost $${totalCogs.toFixed(0)}`} />
          <Stat label="Avg. turns" value={avg((j) => j.numTurns).toFixed(0)} />
          <Stat label="Avg. output tokens" value={`${(avg((j) => j.outputTokens) / 1000).toFixed(0)}k`} />
          <Stat label="Avg. cache reads" value={`${(avg((j) => j.cacheReadTokens) / 1e6).toFixed(2)}M`} />
        </div>

        <Card className="overflow-hidden">
          <CardHeader title="Margin by plan at current cost" description="If every credit is used." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-alpha-400 bg-background-200 text-left text-xs text-gray-900">
                  {["Plan", "Price", "Videos", "Revenue / video", "Gross margin"].map((h) => (
                    <th key={h} className="px-5 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-alpha-400">
                {(["STARTER", "PRO", "AGENCY"] as const).map((id) => {
                  const p = PLANS[id];
                  const vids = p.creditsPerMonth / 2;
                  const rev = p.priceUsd / vids;
                  return (
                    <tr key={id}>
                      <td className="px-5 py-3">{p.name}</td>
                      <td className="px-5 py-3 tabular-nums">${p.priceUsd}</td>
                      <td className="px-5 py-3 tabular-nums">{vids}</td>
                      <td className="px-5 py-3 tabular-nums">${rev.toFixed(2)}</td>
                      <td className="px-5 py-3 tabular-nums">{perVideo ? `${Math.round((1 - perVideo / rev) * 100)}%` : "—"}</td>
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
