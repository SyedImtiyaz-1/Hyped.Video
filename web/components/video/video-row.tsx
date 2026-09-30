import type { Job } from "@launchreel/core";
import { customerError } from "@launchreel/core/engines";
import { Captions, ChevronRight, GitBranch, Globe } from "lucide-react";
import type { ReelJob } from "@launchreel/core/reel";
import { REEL_STYLE_INFO } from "@/components/reels/labels";
import Link from "next/link";
import { FORMAT_LABEL, formatDuration, hostOf, renderSeconds, shortId, timeAgo, toneLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status";
import { VideoThumb } from "./video-thumb";

/** One row in a video list, modelled on Vercel's deployments list. */
export function VideoRow({ job }: { job: Job }) {
  const reel = job.kind === "reel" ? (job.reel as ReelJob | null) : null;
  const SourceIcon = reel ? Captions : job.sourceType === "GITHUB" ? GitBranch : Globe;
  const seconds = renderSeconds(job);
  return (
    <Link
      href={`/dashboard/videos/${job.id}`}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-gray-alpha-100 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_16px]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <VideoThumb job={job} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-1000">{hostOf(job.sourceUrl)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-900">
            <span className="font-mono">{shortId(job.id)}</span>
            {job.parentJobId && <Badge tone="purple">Revision</Badge>}
            {job.watermark && <Badge>Watermark</Badge>}
          </p>
        </div>
      </div>

      <div className="hidden md:block">
        <StatusDot status={job.status} />
        <p className="mt-0.5 pl-[18px] text-xs tabular-nums text-gray-900">{job.status === "QUEUED" ? "Waiting" : formatDuration(seconds)}</p>
      </div>

      <div className="hidden min-w-0 md:block">
        <p className="truncate text-sm text-gray-1000">{reel ? `Reel · ${REEL_STYLE_INFO[reel.style]?.label ?? reel.style} captions` : toneLabel(job.tone)}</p>
        <p className="mt-0.5 truncate text-xs text-gray-900">
          {FORMAT_LABEL[job.format] ?? job.format} · {job.durationSec}s{job.error ? ` · ${customerError(job.error)}` : ""}
        </p>
      </div>

      <div className="hidden items-center gap-2 text-sm text-gray-900 md:flex">
        <SourceIcon className="size-4 shrink-0" />
        <span className="truncate">{timeAgo(job.createdAt)}</span>
      </div>

      <div className="flex items-center gap-3">
        <StatusDot status={job.status} label={false} className="md:hidden" />
        <ChevronRight className="size-4 text-gray-700 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-1000" />
      </div>
    </Link>
  );
}

export function VideoList({ jobs }: { jobs: Job[] }) {
  return (
    <div className="divide-y divide-gray-alpha-400 overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-100">
      {jobs.map((job) => (
        <VideoRow key={job.id} job={job} />
      ))}
    </div>
  );
}
