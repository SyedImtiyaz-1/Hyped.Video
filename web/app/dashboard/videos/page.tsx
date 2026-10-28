import { Clapperboard, Plus, Search } from "lucide-react";
import { AutoRefresh } from "@/components/video/auto-refresh";
import { ProjectGrid } from "@/components/video/project-grid";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageBody, PageHeader } from "@/components/ui/page";
import { SegmentedLinks } from "@/components/ui/segmented";
import { listVideos, parseStatus, type StatusFilter } from "@/lib/data";
import { requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projects" };

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready" },
  { key: "rendering", label: "Rendering" },
  { key: "queued", label: "Queued" },
  { key: "failed", label: "Failed" },
];

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const params = await searchParams;
  const status = parseStatus(params.status);
  const q = params.q?.trim() ?? "";
  const user = await requireUser();
  const jobs = await listVideos(user.id, { status, q, take: 100 });
  const href = (s: StatusFilter) => {
    const sp = new URLSearchParams();
    if (s !== "all") sp.set("status", s);
    if (q) sp.set("q", q);
    const qs = sp.toString();
    return qs ? `/dashboard/videos?${qs}` : "/dashboard/videos";
  };

  return (
    <>
      <AutoRefresh active={jobs.some((j) => j.status === "QUEUED" || j.status === "RUNNING")} />
      <PageHeader
        title="Projects"
        description="Every video, reel and revision you've made, newest first."
        actions={
          <ButtonLink href="/dashboard/new" variant="primary">
            <Plus />
            New video
          </ButtonLink>
        }
      />
      <PageBody className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form action="/dashboard/videos" className="w-full lg:max-w-sm">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            <Input key={q} name="q" defaultValue={q} placeholder="Search by site, repo, clip or notes…" prefix={<Search />} aria-label="Search projects" />
          </form>
          <div className="overflow-x-auto">
            <SegmentedLinks active={status} items={FILTERS.map((f) => ({ ...f, href: href(f.key) }))} />
          </div>
        </div>
        {jobs.length ? (
          <ProjectGrid jobs={jobs} newHref={q || status !== "all" ? undefined : "/dashboard/new"} />
        ) : (
          <Card>
            <EmptyState
              icon={<Clapperboard />}
              title={q || status !== "all" ? "Nothing matches" : "No projects yet"}
              description={q || status !== "all" ? "Try a different search or filter." : "Paste a website or repo and we'll make your first launch video."}
              action={
                <ButtonLink href="/dashboard/new" variant="primary">
                  <Plus />
                  New video
                </ButtonLink>
              }
            />
          </Card>
        )}
      </PageBody>
    </>
  );
}
