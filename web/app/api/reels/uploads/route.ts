import { NextResponse } from "next/server";
import { z } from "zod";
import { REEL_MAX_BYTES, REEL_PART_BYTES, REEL_UPLOAD_TYPES, type ReelUploadType } from "@launchreel/core/reel";
import { isDemo } from "@/lib/demo";
import { newUploadKey, ownsUploadKey, uploadStore } from "@/lib/reel-uploads";
import { requireUser } from "@/lib/user";

const Start = z.object({ contentType: z.enum(Object.keys(REEL_UPLOAD_TYPES) as [ReelUploadType, ...ReelUploadType[]]), bytes: z.number().int().positive() });
const Cancel = z.object({ key: z.string().max(200), uploadId: z.string().min(1).max(2000) });

/** Starts an upload. The browser then sends the file in REEL_PART_BYTES parts (./part) and finishes it (./complete). */
export async function POST(req: Request) {
  if (isDemo) return NextResponse.json({ error: "This is the demo. Connect a database and Clerk to make real reels." }, { status: 403 });
  const user = await requireUser();
  const parsed = Start.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Upload an MP4, MOV or WebM video." }, { status: 400 });
  if (parsed.data.bytes > REEL_MAX_BYTES) return NextResponse.json({ error: `Videos can be up to ${REEL_MAX_BYTES / 1024 / 1024} MB.` }, { status: 413 });
  const key = newUploadKey(user.id, parsed.data.contentType);
  const uploadId = await (await uploadStore()).create(key, parsed.data.contentType);
  return NextResponse.json({ key, uploadId, partBytes: REEL_PART_BYTES });
}

/** Cancels an unfinished upload. */
export async function DELETE(req: Request) {
  const user = await requireUser();
  const parsed = Cancel.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !ownsUploadKey(user.id, parsed.data.key)) return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  await (await uploadStore()).abort(parsed.data.key, parsed.data.uploadId).catch(() => {}); // already finished or gone
  return NextResponse.json({ ok: true });
}
