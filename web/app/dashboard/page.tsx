import { ArrowRight, CircleCheck, Clapperboard, Clock, Coins, Globe, GitPullRequest, Palette, Plus, Scissors } from "lucide-react";
import Link from "next/link";
import { CREDIT_COST, creditsFor, PLANS } from "@launchreel/core";
import { AutoRefresh } from "@/components/video/auto-refresh";
import { VideoList } from "@/components/video/video-row";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageBody, PageHeader, SectionTitle } from "@/components/ui/page";
import { Progress } from "@/components/ui/progress";
import { getStats, listVideos } from "@/lib/data";
import { formatDuration, plural } from "@/lib/format";
import { requireUser } from "@/lib/user";
import { Stat } from "./stat";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const user = await requireUser();
  const [recent, stats] = await Promise.all([listVideos(user.id, { take: 6 }), getStats(user.id)]);
  const plan = PLANS[user.plan];
  const rendering = recent.some((j) => j.status === "QUEUED" || j.status === "RUNNING");

  return (
    <>
      <AutoRefresh active={rendering} />
      <PageHeader
        title="Overview"
        description="Your launch videos, credits and plan at a glance."
        actions={
          <>
            {user.plan === "FREE" && <ButtonLink href="/dashboard/billing">Upgrade</ButtonLink>}
            <ButtonLink href="/dashboard/new" variant="primary">
              <Plus />
              New video
            </ButtonLink>
          </>
        }
      />
      <PageBody className="space-y-8">
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          <Stat label="Credits" value={user.credits} hint={`≈ ${Math.floor(user.credits / CREDIT_COST.newVideo)} videos`} icon={<Coins />} />
          <Stat label="Videos this month" value={stats.videosThisMonth} hint={`${plural(stats.revisionsThisMonth, "revision")} · ${stats.inProgress} in progress`} icon={<Clapperboard />} />
          <Stat label="Success rate" value={stats.successRate == null ? "—" : `${Math.round(stats.successRate * 100)}%`} hint="Last 30 days" icon={<CircleCheck />} />
          <Stat label="Avg. render time" value={formatDuration(stats.avgRenderSeconds)} hint="Last 30 days" icon={<Clock />} />
        </div>

        {recent.length === 0 ? (
          <FirstVideo />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="min-w-0">
              <SectionTitle
                actions={
                  <Link href="/dashboard/videos" className="inline-flex items-center gap-1 text-sm text-gray-900 hover:text-gray-1000">
                    View all <ArrowRight className="size-3.5" />
                  </Link>
                }
              >
                Recent videos
              </SectionTitle>
              <VideoList jobs={recent} />
            </section>
            <aside className="space-y-4">
              <Card>
                <CardHeader title="Plan" actions={<Badge tone={user.plan === "FREE" ? "gray" : "blue"}>{plan.name}</Badge>} />
                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-gray-900">Credits left</span>
                    <span className="font-medium tabular-nums">
                      {user.credits}
                      {plan.creditsPerMonth > 0 && <span className="text-gray-900"> / {plan.creditsPerMonth} a month</span>}
                    </span>
                  </div>
                  <Progress value={user.credits / Math.max(plan.creditsPerMonth, user.credits, 1)} />
                  <p className="text-[13px] text-gray-900">A video up to 30s uses {creditsFor("newVideo", 30)} credits, 60s uses {creditsFor("newVideo", 60)} and 90s uses {creditsFor("newVideo", 90)}. A revision costs half.</p>
                </CardContent>
                <CardFooter>
                  <span>{plan.priceUsd ? `$${plan.priceUsd}/month` : "Free plan"}</span>
                  <ButtonLink href="/dashboard/billing" size="sm">
                    {user.plan === "FREE" ? "Upgrade" : "Manage"}
                  </ButtonLink>
                </CardFooter>
              </Card>
              <Card>
                <CardHeader title="Coming soon" description="What we're building next." />
                <CardContent className="space-y-4 text-sm">
                  <Roadmap icon={<GitPullRequest />} title="Release videos" body="A short video for every GitHub release, ready to approve." />
                  <Roadmap icon={<Palette />} title="Brand kit" body="Your logo, colors and voice in every video." />
                  <Roadmap icon={<Scissors />} title="Social cut-downs" body="6–10 second clips with captions for each platform." />
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </PageBody>
    </>
  );
}

function Roadmap({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-gray-alpha-400 text-gray-900 [&_svg]:size-3.5">{icon}</span>
      <div>
        <p className="font-medium text-gray-1000">{title}</p>
        <p className="mt-0.5 text-[13px] text-gray-900">{body}</p>
      </div>
    </div>
  );
}

function FirstVideo() {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Make your first launch video</h2>
          <p className="mt-2 max-w-lg text-sm text-gray-900">Paste your website or a public GitHub repo. We&apos;ll plan, animate and render a 20-second video from your real product in about 15 minutes.</p>
          <form action="/dashboard/new" method="get" className="mt-6 flex max-w-lg flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Input name="url" placeholder="https://yourproduct.com" prefix={<Globe />} aria-label="Website or repo URL" />
            </div>
            <Button type="submit" variant="primary">
              Continue <ArrowRight />
            </Button>
          </form>
        </div>
        <div className="hidden aspect-video w-72 items-center justify-center rounded-lg border border-dashed border-gray-alpha-500 bg-background-200 text-gray-700 md:flex">
          <Clapperboard className="size-8" />
        </div>
      </div>
    </Card>
  );
}
