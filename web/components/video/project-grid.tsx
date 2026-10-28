import type { Job } from "@launchreel/core";
import { Captions, Plus } from "lucide-react";
import Link from "next/link";
import { reelName } from "@/components/reels/labels";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status";
import { hostOf, timeAgo } from "@/lib/format";
import { VideoThumb } from "./video-thumb";

/** A video or reel as a card: its poster, what it's of, when, and how long it runs. */
function ProjectCard({ job }: { job: Job }) {
  const reel = job.kind === "reel";
  return (
    <Link href={`/dashboard/videos/${job.id}`} className="group block min-w-0">
      <div className="relative">
        <VideoThumb job={job} className="w-full rounded-xl transition-colors group-hover:border-gray-alpha-500" />
        {job.status !== "SUCCEEDED" && (
          <span className="absolute left-2 top-2 rounded-full bg-background-100/90 px-2 py-0.5 backdrop-blur-sm">
            <StatusDot status={job.status} />
          </span>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 truncate text-sm font-medium text-gray-1000">
        {reel && <Captions className="size-3.5 shrink-0 text-gray-900" aria-label="Reel" />}
        <span className="truncate">{reel ? reelName(job.sourceUrl) : hostOf(job.sourceUrl)}</span>
        {job.parentJobId && <Badge tone="purple">Revision</Badge>}
      </p>
      <p className="mt-0.5 truncate text-xs text-gray-900">
        {timeAgo(job.createdAt)} · <span className="tabular-nums">{job.durationSec}s</span>
      </p>
    </Link>
  );
}

/** The customer's videos and reels as a grid of cards, newest first, behind a tile to start a new one (`newHref`). */
export function ProjectGrid({ jobs, newHref }: { jobs: Job[]; newHref?: string }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {newHref && (
        <Link href={newHref} className="group block">
          <div className="flex aspect-video items-center justify-center rounded-xl border border-gray-alpha-400 bg-background-200 text-gray-900 transition-colors group-hover:border-gray-alpha-500 group-hover:text-gray-1000">
            <Plus className="size-5" />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-1000">New project</p>
          <p className="mt-0.5 text-xs text-gray-900">Start empty</p>
        </Link>
      )}
      {jobs.map((job) => (
        <ProjectCard key={job.id} job={job} />
      ))}
    </div>
  );
}
