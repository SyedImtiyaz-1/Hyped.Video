import { NextResponse } from "next/server";
import { z } from "zod";
import { parseLookChanges, parseReel, parseReelEdit, REEL_FONTS, REEL_MAX_FONTS, REEL_STYLES, reelEditable, type ReelFont, type ReelJob, type ReelStyle } from "@launchreel/core";
import { getDb, startExport } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { readEdit, writeEdit } from "@/lib/reel-edits";
import { uploadStore } from "@/lib/reel-uploads";
import { requireUser } from "@/lib/user";

// An export still "rendering" after this long died somewhere; a new one may start.
const STALE_EXPORT_MS = 40 * 60_000;
// Exports are free while the upload is kept, but not unlimited.
const MAX_EXPORTS = 30;

const Body = z.object({
  options: z.object({
    style: z.enum(REEL_STYLES as [ReelStyle, ...ReelStyle[]]),
    look: z.unknown().optional().transform((look) => parseLookChanges(look)),
    fonts: z
      .array(z.enum(REEL_FONTS as [ReelFont, ...ReelFont[]]))
      .min(1)
      .max(REEL_MAX_FONTS)
      .transform((fonts) => [...new Set(fonts)]),
    emojis: z.boolean(),
    zooms: z.boolean(),
    sfx: z.boolean(),
    hook: z.boolean(),
  }),
  edit: z.unknown(),
});

async function ownReel(id: string) {
  const user = await requireUser();
  const db = await getDb();
  const job = await db.job.findFirst({ where: { id, userId: user.id, kind: "reel" } });
  return { db, job, reel: job ? parseReel(job.reel) : null };
}

/** The latest export and the reel's current video, for the editor to follow an export. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { job, reel } = await ownReel((await params).id);
  if (!job || !reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  return NextResponse.json({ export: reel.export ?? null, videoUrl: job.videoUrl, posterUrl: job.posterUrl });
}

/**
 * Re-exports an edited reel, free while its upload is kept (REEL_EDIT_DAYS): saves the edits and the new options, then
 * starts the render. The words keep their original timings; only their spelling, the marks and the hook can change.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isDemo) return NextResponse.json({ error: "This is the demo. Connect a database and Clerk to edit real reels." }, { status: 403 });
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Those edits couldn't be read." }, { status: 400 });
  const { db, job, reel } = await ownReel(id);
  if (!job || !reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  const editable = reelEditable(job, reel);
  if (!editable.ok) return NextResponse.json({ error: editable.reason }, { status: 400 });
  if (reel.export?.status === "rendering" && Date.now() - Date.parse(reel.export.startedAt) < STALE_EXPORT_MS) {
    return NextResponse.json({ error: "This reel is already exporting. It'll be ready in a minute or two." }, { status: 409 });
  }
  const revision = (reel.export?.revision ?? 0) + 1;
  if (revision > MAX_EXPORTS) return NextResponse.json({ error: `A reel can be exported ${MAX_EXPORTS} times. Make a new reel to keep editing.` }, { status: 429 });

  const original = await readEdit(id);
  if (!original) return NextResponse.json({ error: "This reel was made before editing was available. Make it again to edit it." }, { status: 400 });
  const edit = parseReelEdit(parsed.data.edit, original);
  if (!edit) return NextResponse.json({ error: "Every word needs some text, in letters the captions can show." }, { status: 400 });
  if (!(await (await uploadStore()).head(reel.key))) {
    return NextResponse.json({ error: "This reel's upload has been deleted, so it can't be exported again." }, { status: 400 });
  }

  await writeEdit(id, edit);
  const exporting = { revision, status: "rendering" as const, startedAt: new Date().toISOString() };
  const next: ReelJob = { ...reel, ...parsed.data.options, export: exporting };
  await db.job.update({ where: { id }, data: { reel: next } });
  try {
    await startExport(id, revision);
  } catch {
    await db.job.update({ where: { id }, data: { reel: { ...next, export: { ...exporting, status: "failed", error: "The export couldn't start" } } } });
    return NextResponse.json({ error: "The export couldn't start. Try again in a moment." }, { status: 503 });
  }
  return NextResponse.json({ export: exporting });
}
