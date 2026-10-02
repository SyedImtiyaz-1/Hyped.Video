import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseReel, REEL_EDIT_DAYS, reelEditable } from "@launchreel/core/reel";
import { ButtonLink } from "@/components/ui/button";
import { reelName } from "@/components/reels/labels";
import { ReelEditor } from "@/components/reels/reel-editor";
import { getVideo } from "@/lib/data";
import { readEdit } from "@/lib/reel-edits";
import { requireUser } from "@/lib/user";

export const metadata: Metadata = { title: "Edit reel" };

/** The reel editor, for a finished reel within its free-edit window that has its saved decisions. */
export default async function EditReelPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const { id } = await params;
  // ?t=12.4: opened from the reel's player at that second.
  const t = Number((await searchParams).t);
  const user = await requireUser();
  const data = await getVideo(user.id, id);
  const reel = data?.job.kind === "reel" ? parseReel(data.job.reel) : null;
  if (!data || !reel) notFound();
  const { job } = data;
  const editable = reelEditable(job, reel);
  const edit = editable.ok ? await readEdit(id).catch(() => null) : null;
  if (!editable.ok || !edit) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 text-center">
        <h1 className="text-lg font-medium text-gray-1000">This reel can&apos;t be edited</h1>
        <p className="mt-2 text-sm text-gray-900">{editable.reason ?? "It was made before editing was available. Make the reel again to edit it here."}</p>
        <ButtonLink href={`/dashboard/videos/${id}`} variant="secondary" className="mt-6">
          <ArrowLeft />
          Back to the reel
        </ButtonLink>
      </div>
    );
  }
  return (
    <ReelEditor
      jobId={id}
      name={reelName(reel.fileName)}
      options={{ style: reel.style, look: reel.look, fonts: reel.fonts, emojis: reel.emojis, zooms: reel.zooms, sfx: reel.sfx, hook: reel.hook }}
      edit={edit}
      previewUrl={`/api/reels/${id}/preview`}
      initialExport={reel.export ?? null}
      editableUntil={new Date(job.createdAt.getTime() + REEL_EDIT_DAYS * 86_400_000).toISOString()}
      startAt={Number.isFinite(t) && t >= 0 ? t : undefined}
    />
  );
}
