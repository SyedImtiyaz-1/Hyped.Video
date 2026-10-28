import type { Job, Quality } from "@launchreel/core";
import { voiceById } from "@launchreel/core/voices";
import { creditsFor } from "@launchreel/core/pricing";
import { customerError } from "@launchreel/core/engines";
import { parseReel, reelEditable, reelError } from "@launchreel/core/reel";
import { ArrowUpRight, Captions, Download, GitBranch, Globe, Pencil, Upload } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { REEL_FONT_INFO, REEL_LANGUAGE_LABEL, REEL_STYLE_INFO, reelExtras, reelName } from "@/components/reels/labels";
import { ReelPreview } from "@/components/reels/reel-preview";
import { AutoRefresh } from "@/components/video/auto-refresh";
import { ReviseForm } from "@/components/video/revise-form";
import { VideoPreview } from "@/components/video/video-preview";
import { VideoList } from "@/components/video/video-row";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { PageBody, PageHeader } from "@/components/ui/page";
import { STATUS } from "@/components/ui/status";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { getVideo } from "@/lib/data";
import { FORMAT_LABEL, formatDateTime, formatDuration, hostOf, QUALITY_LABEL, renderSeconds, shortId, toneLabel } from "@/lib/format";
import { requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: `Video ${(await params).id.slice(-8)}` };
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const data = await getVideo(user.id, id);
  if (!data) notFound();
  const { job, parent, revisions } = data;
  const status = STATUS[job.status];
  const active = job.status === "QUEUED" || job.status === "RUNNING";
  // Reels (the customer's own video, captioned) share this page: no source link, agent storyboard or revisions.
  const reel = job.kind === "reel" ? parseReel(job.reel) : null;

  return (
    <>
      <AutoRefresh active={active} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {reel ? (
              <span className="min-w-0 [overflow-wrap:anywhere]" title={reel.fileName}>
                {reelName(reel.fileName)}
              </span>
            ) : (
              hostOf(job.sourceUrl)
            )}
            {reel && (
              <Badge tone="purple" size="md">
                Reel
              </Badge>
            )}
            <Badge tone={status.tone} size="md">
              <span className={cn("size-1.5 rounded-full", status.dot)} />
              {status.label}
            </Badge>
          </span>
        }
        description={
          reel ? (
            `${FORMAT_LABEL[job.format] ?? job.format} · ${job.durationSec}s · ${REEL_STYLE_INFO[reel.style].label} captions`
          ) : (
            <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-gray-1000">
              {job.sourceUrl}
              <ArrowUpRight className="size-3.5" />
            </a>
          )
        }
        actions={
          job.videoUrl && (
            <>
              {/* A reel can be edited and exported again, free, while its upload is kept. */}
              {reel && reelEditable(job, reel).ok && (
                <Link href={`/dashboard/videos/${job.id}/edit`} className={buttonClasses({})}>
                  <Pencil />
                  Edit reel
                </Link>
              )}
              {/* The share page previews well on X, LinkedIn and WhatsApp; Download still gives the file itself. */}
              <CopyButton value={`${BRAND.url}/v/${job.id}`} label="Copy share link" size="md" />
              {job.captionsUrl && (
                <a href={job.captionsUrl} download className={buttonClasses({})}>
                  <Captions />
                  Captions (SRT)
                </a>
              )}
              <a href={job.videoUrl} target="_blank" rel="noreferrer" className={buttonClasses({ variant: "primary" })}>
                <Download />
                Download
              </a>
            </>
          )
        }
      />
      <PageBody>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <Card>
              <CardContent className="p-3 md:p-4">{reel ? <ReelPreview job={job} editHref={reelEditable(job, reel).ok ? `/dashboard/videos/${job.id}/edit` : undefined} /> : <VideoPreview job={job} />}</CardContent>
            </Card>

            {job.shareCopy && (
              <Card>
                <CardHeader title="Share copy" description="Ready to post with your video." actions={<CopyButton value={job.shareCopy} />} />
                <CardContent>
                  <p className="text-[15px] leading-relaxed text-gray-1000">{job.shareCopy}</p>
                </CardContent>
              </Card>
            )}

            {job.plan && (
              <Card>
                <CardHeader title={reel ? "Edit" : "Storyboard"} description={reel ? "What we added to your video." : "The plan the agent followed for this video."} />
                <CardContent>
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[13px] leading-6 text-gray-1000">{job.plan}</pre>
                </CardContent>
              </Card>
            )}

            {!reel && (job.status === "SUCCEEDED" || revisions.length > 0) && (
              <Card>
                <CardHeader title="Revisions" description="Describe a change in plain English. The agent edits this video instead of starting over." />
                <CardContent className="space-y-5">
                  {revisions.length > 0 && <VideoList jobs={revisions} />}
                  {job.status === "SUCCEEDED" && <ReviseForm jobId={job.id} credits={user.credits} cost={creditsFor("revision", job.durationSec, job.quality as Quality)} />}
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-6">
            <Card>
              <CardHeader title="Details" />
              <dl className="divide-y divide-gray-alpha-400 text-sm">
                {reel ? (
                  <>
                    <Row label="Source">
                      <span className="flex min-w-0 items-center gap-1.5" title={reel.fileName}>
                        <Upload className="size-4 shrink-0 text-gray-900" />
                        <span className="min-w-0 truncate">{reelName(reel.fileName)}</span>
                      </span>
                    </Row>
                    <Row label="Captions">
                      {REEL_STYLE_INFO[reel.style].label}
                      {reel.style === "behind" && ` (${reel.fonts.map((f) => REEL_FONT_INFO[f].label).join(" + ")})`} · {REEL_LANGUAGE_LABEL[reel.language]}
                    </Row>
                    <Row label="Extras">{reelExtras(reel)}</Row>
                  </>
                ) : (
                  <>
                    <Row label="Source">
                      <span className="flex min-w-0 items-center gap-1.5" title={job.sourceUrl}>
                        {job.sourceType === "GITHUB" ? <GitBranch className="size-4 shrink-0 text-gray-900" /> : <Globe className="size-4 shrink-0 text-gray-900" />}
                        <span className="min-w-0 truncate">{hostOf(job.sourceUrl)}</span>
                      </span>
                    </Row>
                    <Row label="Quality">{QUALITY_LABEL[job.quality] ?? "Standard"}</Row>
                    <Row label="Voiceover">{voiceById(job.voice) ? `${voiceById(job.voice)!.name} · ${job.captions ? "captions burned in" : "no burned-in captions"}` : "None"}</Row>
                    <Row label="Tone">{toneLabel(job.tone)}</Row>
                  </>
                )}
                <Row label="Format">
                  {FORMAT_LABEL[job.format] ?? job.format} · {job.durationSec}s
                </Row>
                <Row label="Credits">
                  {job.creditsCost}
                  {job.status === "FAILED" && <span className="text-gray-900"> · refunded</span>}
                </Row>
                {job.watermark && <Row label="Watermark">Free trial</Row>}
                {parent && (
                  <Row label="Revision of">
                    <Link href={`/dashboard/videos/${parent.id}`} className="font-mono text-[13px] underline-offset-4 hover:underline">
                      {shortId(parent.id)}
                    </Link>
                  </Row>
                )}
                {job.notes && <Row label={parent ? "Change" : "Direction"}>{job.notes}</Row>}
                <Row label="Video ID">
                  <span className="font-mono text-[13px]">{shortId(job.id)}</span>
                </Row>
              </dl>
            </Card>
            <Card>
              <CardHeader title="Timeline" />
              <CardContent>
                <Timeline job={job} />
              </CardContent>
            </Card>
          </aside>
        </div>
      </PageBody>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-5 py-3">
      <dt className="text-gray-900">{label}</dt>
      <dd className="min-w-0 text-gray-1000">{children}</dd>
    </div>
  );
}

function Timeline({ job }: { job: Job }) {
  const failed = job.status === "FAILED";
  const waited = job.startedAt ? (job.startedAt.getTime() - job.createdAt.getTime()) / 1000 : null;
  const steps = [
    { label: "Queued", at: job.createdAt, detail: waited != null ? `Waited ${formatDuration(waited)}` : "Waiting for a render slot", state: "done" as const },
    {
      label: "Rendering",
      at: job.startedAt,
      detail: job.startedAt ? `${job.finishedAt ? "Took" : "Running for"} ${formatDuration(renderSeconds(job))}` : "Not started",
      state: job.finishedAt ? ("done" as const) : job.startedAt ? ("active" as const) : ("pending" as const),
    },
    {
      label: failed ? "Failed, credits refunded" : "Ready",
      at: job.finishedAt,
      detail: failed ? (job.kind === "reel" ? reelError(job.error) : customerError(job.error)) : job.finishedAt ? `${job.kind === "reel" ? "Reel" : "Video"} delivered` : "Not finished",
      state: job.finishedAt ? (failed ? ("error" as const) : ("done" as const)) : ("pending" as const),
    },
  ];
  const dot = { done: "bg-green-700", active: "bg-amber-700 animate-pulse-dot", pending: "bg-gray-alpha-500", error: "bg-red-800" };
  return (
    <ol className="relative space-y-5">
      {steps.map((s, i) => (
        <li key={s.label} className="relative flex gap-3">
          {i < steps.length - 1 && <span className="absolute left-[4.5px] top-4 h-[calc(100%+4px)] w-px bg-gray-alpha-400" aria-hidden />}
          <span className={cn("relative mt-1.5 size-2.5 shrink-0 rounded-full", dot[s.state])} />
          <div className="min-w-0">
            <p className={cn("text-sm font-medium", s.state === "pending" ? "text-gray-900" : "text-gray-1000")}>{s.label}</p>
            <p className="text-[13px] text-gray-900">
              {s.at ? `${formatDateTime(s.at)} · ` : ""}
              {s.detail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
