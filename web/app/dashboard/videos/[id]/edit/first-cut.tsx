import type { Job } from "@launchreel/core";
import { customerError } from "@launchreel/core/engines";
import { Captions, Globe, LoaderCircle, TriangleAlert } from "lucide-react";
import { reelError } from "@launchreel/core/reel";
import { reelName } from "@/components/reels/labels";
import { ButtonLink } from "@/components/ui/button";
import { AutoRefresh } from "@/components/video/auto-refresh";
import { cn } from "@/lib/cn";
import { formatDuration, hostOf, renderSeconds } from "@/lib/format";
import { AiSaid, EditorFrame, LibraryItem, YouSaid } from "./editor-frame";

/**
 * The editor while a video's first cut is being made (opened right after the prompt box starts it, as Cardboard's
 * editor does): what it's made from, what was asked, how far it's got. It refreshes itself and becomes the editor once
 * the cut is ready; a failed one says why, with its credits back.
 */
export function FirstCut({ job }: { job: Job }) {
  const reel = job.kind === "reel";
  const failed = job.status === "FAILED";
  const running = job.status === "RUNNING";
  const name = reel ? reelName(job.sourceUrl) : hostOf(job.sourceUrl);
  const steps = [
    { label: "Queued", state: "done" },
    { label: reel ? "Cutting, captioning and adding the extras" : "Reading your product and making the video", state: failed ? "error" : running ? "active" : "pending" },
    { label: "Your first cut, here to edit", state: "pending" },
  ] as const;
  return (
    <>
      <AutoRefresh active={!failed} />
      <EditorFrame
        name={name}
        detail={failed ? "This one didn't work" : `${reel ? "Reel" : "Video"} · first cut on its way`}
        library={<LibraryItem icon={reel ? <Captions /> : <Globe />} title={name} detail={reel ? `Your clip · ${job.durationSec}s` : "Your website or repo"} />}
        stage={
          failed ? (
            <div className="max-w-sm text-center">
              <TriangleAlert className="mx-auto size-6 text-red-900" />
              <p className="mt-3 text-sm font-medium text-gray-1000">This one didn&apos;t work</p>
              <p className="mt-1 text-[13px] text-gray-900">{reel ? reelError(job.error) : customerError(job.error)} Your credits are back.</p>
              <ButtonLink href="/dashboard" className="mt-5">
                Try again
              </ButtonLink>
            </div>
          ) : (
            <div className="max-w-sm text-center">
              <LoaderCircle className="mx-auto size-6 animate-spin text-gray-900" />
              <p className="mt-3 text-sm font-medium text-gray-1000">Hyped is making your first cut</p>
              <p className="mt-1 text-[13px] text-gray-900">
                {running ? `Working for ${formatDuration(renderSeconds(job))}. ` : "Waiting for a render slot. "}
                {reel ? "A few minutes for most clips." : "Usually 10–20 minutes."} You can leave this page; it opens here when it&apos;s ready.
              </p>
            </div>
          )
        }
        side={
          <div className="flex flex-1 flex-col gap-2 rounded-lg border border-gray-alpha-400 p-3">
            {job.notes && <YouSaid>{job.notes}</YouSaid>}
            <AiSaid>
              <ol className="space-y-1.5">
                {steps.map((s) => (
                  <li key={s.label} className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", s.state === "done" ? "bg-green-700" : s.state === "active" ? "animate-pulse-dot bg-amber-700" : s.state === "error" ? "bg-red-800" : "bg-gray-alpha-500")} />
                    <span className={s.state === "pending" ? "text-gray-900" : ""}>{s.label}</span>
                  </li>
                ))}
              </ol>
            </AiSaid>
            <p className="mt-auto rounded-lg border border-dashed border-gray-alpha-500 px-3 py-2 text-[13px] text-gray-900">You can ask for changes here once the first cut is ready.</p>
          </div>
        }
        timeline={<div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-gray-alpha-500 text-[13px] text-gray-900">The timeline fills in when the first cut is ready.</div>}
      />
    </>
  );
}
