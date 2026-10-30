import { CircleCheck, Clapperboard, Clock, Coins } from "lucide-react";
import { PromptBox } from "@/components/create/prompt-box";
import { CategoryChips, GalleryFilterProvider } from "@/components/recipes/gallery-filter";
import { RecipeBrowser } from "@/components/recipes/recipe-browser";
import { RemixStrip } from "@/components/recipes/remix-strip";
import { AutoRefresh } from "@/components/video/auto-refresh";
import { ProjectGrid } from "@/components/video/project-grid";
import { PageBody, SectionTitle } from "@/components/ui/page";
import { getStats, listVideos } from "@/lib/data";
import { isDemo } from "@/lib/demo";
import { formatDuration, plural } from "@/lib/format";
import { requireUser } from "@/lib/user";
import { HomeTabs } from "./home-tabs";
import { Stat } from "./stat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home" };

/**
 * The dashboard's home is a workspace, like Cardboard's app (the marketing look stays on the landing page): the prompt
 * box with the template types as chips under it, then one card with the templates (videos to remix, then every template
 * by category) and the customer's own projects, and this month's numbers at the bottom. A chip opens its templates in
 * the card; templates open in a modal over the page (recipe-modal.tsx).
 */
export default async function Home() {
  const user = await requireUser();
  const [recent, stats] = await Promise.all([listVideos(user.id, { take: 14 }), getStats(user.id)]);
  const rendering = recent.some((j) => j.status === "QUEUED" || j.status === "RUNNING");

  return (
    <GalleryFilterProvider>
      <AutoRefresh active={rendering} />
      <section className="mx-auto max-w-3xl px-4 pb-8 pt-8 md:pb-10 md:pt-12">
        <h1 className="sr-only">Home</h1>
        <PromptBox variant="app" shortcuts={false} demo={isDemo} />
        <CategoryChips className="mt-4" />
      </section>

      <PageBody className="space-y-10 pt-2">
        <HomeTabs
          recipes={
            <div className="space-y-10">
              <RemixStrip />
              <div className="h-px bg-gray-alpha-400" />
              <RecipeBrowser />
            </div>
          }
          projects={<ProjectGrid jobs={recent} newHref="/dashboard/new" />}
        />
        <section>
          <SectionTitle>This month</SectionTitle>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <Stat label="Credits" value={user.credits} hint={`Enough for ${plural(user.credits, "short video")}`} icon={<Coins />} />
            <Stat label="Videos this month" value={stats.videosThisMonth} hint={`${plural(stats.revisionsThisMonth, "revision")} · ${stats.inProgress} in progress`} icon={<Clapperboard />} />
            <Stat label="Success rate" value={stats.successRate == null ? "—" : `${Math.round(stats.successRate * 100)}%`} hint="Last 30 days" icon={<CircleCheck />} />
            <Stat label="Avg. render time" value={formatDuration(stats.avgRenderSeconds)} hint="Last 30 days" icon={<Clock />} />
          </div>
        </section>
      </PageBody>
    </GalleryFilterProvider>
  );
}
