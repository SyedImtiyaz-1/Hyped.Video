import type { Job } from "@launchreel/core";
import { reelError } from "@launchreel/core/reel";
import { Hourglass, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

const FRAME: Record<string, string> = {
  landscape: "aspect-video w-full",
  vertical: "aspect-[9/16] h-[min(70vh,640px)] mx-auto max-w-full",
  square: "aspect-square h-[min(70vh,560px)] mx-auto max-w-full",
};

/** The job page's player for a reel (components/video/video-preview.tsx, with a reel's timings and errors). */
export function ReelPreview({ job }: { job: Job }) {
  const frame = FRAME[job.format] ?? FRAME.vertical;
  if (job.videoUrl) {
    return (
      <div className={cn("overflow-hidden rounded-lg border border-gray-alpha-400 bg-black", frame)}>
        <video src={job.videoUrl} poster={job.posterUrl ?? undefined} controls playsInline preload="metadata" className="size-full" />
      </div>
    );
  }
  const state =
    job.status === "RUNNING"
      ? { icon: <LoaderCircle className="animate-spin" />, title: "Editing your reel", body: "Captions, zooms and sound are going in. Usually 1–3 minutes. This page updates on its own." }
      : job.status === "QUEUED"
        ? { icon: <Hourglass />, title: "Waiting for a render slot", body: "Your reel starts as soon as a machine is free. This page updates on its own." }
        : job.status === "FAILED"
          ? { icon: <TriangleAlert className="text-red-900" />, title: "This reel failed", body: `${reelError(job.error)} Your credits were refunded automatically.` }
          : { icon: <Hourglass />, title: "Preview unavailable", body: "The video file is missing. Contact support if this persists." };
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-alpha-500 bg-background-200 p-8 text-center", frame, job.format !== "landscape" && "min-w-[260px]")}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full border border-gray-alpha-400 bg-background-100 text-gray-900 [&_svg]:size-5">{state.icon}</div>
      <p className="text-sm font-semibold text-gray-1000">{state.title}</p>
      <p className="mt-1 max-w-sm text-sm text-gray-900">{state.body}</p>
    </div>
  );
}
