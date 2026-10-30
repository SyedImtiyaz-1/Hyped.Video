import type { Job, Quality } from "@launchreel/core";
import { creditsFor } from "@launchreel/core/pricing";
import { Download, FileText, Globe, Megaphone } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ReviseForm } from "@/components/video/revise-form";
import { VideoPreview } from "@/components/video/video-preview";
import { hostOf } from "@/lib/format";
import { AiSaid, EditorFrame, LibraryItem, YouSaid } from "./editor-frame";

/**
 * A finished product video in the editor. Until product videos have the reel editor's tools (Syed's product video
 * editor), changes go through Ask AI as a revision, which opens here too; the library has its files.
 */
export function ProductVideo({ job, credits }: { job: Job; credits: number }) {
  const name = hostOf(job.sourceUrl);
  return (
    <EditorFrame
      name={name}
      detail={`Product video · ${job.durationSec}s`}
      actions={
        job.videoUrl && (
          <a href={job.videoUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "primary" })}>
            <Download /> Export MP4
          </a>
        )
      }
      library={
        <div className="space-y-2">
          <LibraryItem icon={<Globe />} title={name} detail="Your website or repo" />
          {job.captionsUrl && (
            <LibraryItem
              icon={<FileText />}
              title="Captions"
              detail="SRT file"
              action={
                <a href={job.captionsUrl} download className={buttonClasses({ size: "sm" })}>
                  <Download />
                </a>
              }
            />
          )}
          {job.shareCopy && <LibraryItem icon={<Megaphone />} title="Share copy" detail="For X, LinkedIn and Product Hunt" action={<CopyButton value={job.shareCopy} />} />}
        </div>
      }
      stage={
        <div className="w-full max-w-3xl">
          <VideoPreview job={job} />
        </div>
      }
      side={
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex-1 space-y-2 rounded-lg border border-gray-alpha-400 p-3">
            {job.notes && <YouSaid>{job.notes}</YouSaid>}
            <AiSaid>Your video is ready. Tell me what to change, and I&apos;ll make a new version: it opens here when it&apos;s done.</AiSaid>
          </div>
          <ReviseForm jobId={job.id} credits={credits} cost={creditsFor("revision", job.durationSec, job.quality as Quality)} editor />
        </div>
      }
      timeline={
        <div className="rounded-xl border border-gray-alpha-400 p-3">
          <div className="flex h-12 items-center rounded-md bg-gray-alpha-100 px-3 text-[13px] text-gray-900">
            <span className="h-6 flex-1 rounded bg-brand/40" />
          </div>
          <p className="mt-2 text-[12px] text-gray-900">Scene-by-scene editing of product videos is coming. Until then, ask for changes on the right.</p>
        </div>
      }
    />
  );
}
