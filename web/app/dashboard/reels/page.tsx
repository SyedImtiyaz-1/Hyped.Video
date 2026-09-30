import type { Job } from "@launchreel/core";
import { Captions } from "lucide-react";
import { ReelForm } from "@/components/reels/reel-form";
import { ReelList } from "@/components/reels/reel-list";
import { AutoRefresh } from "@/components/video/auto-refresh";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, SectionTitle } from "@/components/ui/page";
import { getDb } from "@/lib/db";
import { demoJobs, isDemo } from "@/lib/demo";
import { requireUser } from "@/lib/user";

export const metadata = { title: "Reels" };
export const dynamic = "force-dynamic";

export default async function ReelsPage() {
  const user = await requireUser();
  const [reels, paid]: [Job[], number] = isDemo
    ? [demoJobs().filter((j) => j.kind === "reel"), 1]
    : await getDb().then((db) =>
        Promise.all([
          db.job.findMany({ where: { userId: user.id, kind: "reel" }, orderBy: { createdAt: "desc" }, take: 50 }),
          // Reels made before the first purchase carry the watermark, like videos (see /api/reels).
          db.creditEntry.count({ where: { userId: user.id, delta: { gt: 0 }, NOT: { reason: "signup_trial" } } }),
        ]),
      );

  return (
    <>
      <AutoRefresh active={reels.some((j) => j.status === "QUEUED" || j.status === "RUNNING")} />
      <PageHeader narrow title="Reels" description="Your own talking-head video, Short or demo, back with animated captions, zooms and sound effects." />
      <PageBody className="max-w-[880px] space-y-8">
        <ReelForm credits={user.credits} trial={paid === 0} />
        <section>
          <SectionTitle>Your reels</SectionTitle>
          {reels.length ? (
            <ReelList jobs={reels} />
          ) : (
            <Card>
              <EmptyState icon={<Captions />} title="No reels yet" description="Upload a video above. Most reels are ready in a few minutes." />
            </Card>
          )}
        </section>
      </PageBody>
    </>
  );
}
