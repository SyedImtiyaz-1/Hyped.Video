import { Clapperboard, Coins, Flame, WandSparkles } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { getUsage } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { describeEntry } from "@/lib/ledger";
import { requireUser } from "@/lib/user";
import { Stat } from "../stat";

export const metadata = { title: "Usage" };
export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const user = await requireUser();
  const { daily, ledger, spent30 } = await getUsage(user.id);
  const videos30 = daily.reduce((a, d) => a + d.videos, 0);
  const revisions30 = daily.reduce((a, d) => a + d.revisions, 0);
  const peak = Math.max(1, ...daily.map((d) => d.videos + d.revisions));
  let balance = user.credits;
  const rows = ledger.map((e) => {
    const row = { ...e, balance };
    balance -= e.delta;
    return row;
  });

  return (
    <>
      <PageHeader title="Usage" description="Credits and renders over the last 30 days." />
      <PageBody className="space-y-8">
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <Stat label="Credits left" value={user.credits} icon={<Coins />} />
          <Stat label="Credits spent" value={spent30} hint="Last 30 days" icon={<Flame />} />
          <Stat label="Videos" value={videos30} hint="Last 30 days" icon={<Clapperboard />} />
          <Stat label="Revisions" value={revisions30} hint="Last 30 days" icon={<WandSparkles />} />
        </div>

        <Card>
          <CardHeader
            title="Renders per day"
            actions={
              <div className="flex items-center gap-4 text-xs text-gray-900">
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-gray-1000" />Videos</span>
                <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-gray-alpha-500" />Revisions</span>
              </div>
            }
          />
          <CardContent>
            <div className="flex h-44 items-end gap-[3px]">
              {daily.map((d) => {
                const total = d.videos + d.revisions;
                const label = `${d.day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${d.videos} videos, ${d.revisions} revisions`;
                return (
                  <div key={d.day.toISOString()} className="group flex h-full flex-1 flex-col justify-end" title={label}>
                    {total === 0 ? (
                      <div className="h-px w-full bg-gray-alpha-400" />
                    ) : (
                      <div className="flex w-full flex-col overflow-hidden rounded-[3px] transition-opacity group-hover:opacity-80" style={{ height: `${(total / peak) * 100}%` }}>
                        <div className="w-full bg-gray-alpha-500" style={{ flex: d.revisions }} />
                        <div className="w-full bg-gray-1000" style={{ flex: d.videos }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-900">
              <span>{daily[0].day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              <span>Today</span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Credit history" description="Every credit in and out of your account." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-alpha-400 bg-background-200 text-left text-xs text-gray-900">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Description</th>
                  <th className="px-5 py-2.5 text-right font-medium">Change</th>
                  <th className="px-5 py-2.5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-alpha-400">
                {rows.map((e) => {
                  const d = describeEntry(e.reason);
                  return (
                    <tr key={e.id}>
                      <td className="whitespace-nowrap px-5 py-3 text-gray-900">{formatDateTime(e.createdAt)}</td>
                      <td className="px-5 py-3">
                        {d.href ? (
                          <Link href={d.href} className="underline-offset-4 hover:underline">
                            {d.label}
                          </Link>
                        ) : (
                          d.label
                        )}
                      </td>
                      <td className={cn("whitespace-nowrap px-5 py-3 text-right font-mono tabular-nums", e.delta > 0 ? "text-green-900" : "text-gray-1000")}>
                        {e.delta > 0 ? `+${e.delta}` : e.delta}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-mono tabular-nums text-gray-900">{e.balance}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </PageBody>
    </>
  );
}
