import type { Job } from "@launchreel/core";
import { Film, Hourglass, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export function VideoThumb({ job, className }: { job: Pick<Job, "status" | "posterUrl">; className?: string }) {
  return (
    <div className={cn("relative aspect-video w-[88px] shrink-0 overflow-hidden rounded-md border border-gray-alpha-400 bg-gray-100", className)}>
      {job.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- posters come from our own storage domain
        <img src={job.posterUrl} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-gray-700 [&_svg]:size-4">
          {job.status === "RUNNING" ? <LoaderCircle className="animate-spin" /> : job.status === "QUEUED" ? <Hourglass /> : job.status === "FAILED" ? <TriangleAlert className="text-red-900" /> : <Film />}
        </div>
      )}
    </div>
  );
}
