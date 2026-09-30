import { NextResponse } from "next/server";
import { z } from "zod";
import { REEL_MAX_BYTES, REEL_PART_BYTES } from "@launchreel/core/reel";
import { looksLikeVideo, ownsUploadKey, uploadStore } from "@/lib/reel-uploads";
import { requireUser } from "@/lib/user";

const Body = z.object({
  key: z.string().max(200),
  uploadId: z.string().min(1).max(2000),
  parts: z
    .array(z.object({ partNumber: z.number().int().positive(), etag: z.string().min(1).max(500) }))
    .min(1)
    .max(Math.ceil(REEL_MAX_BYTES / REEL_PART_BYTES)),
});

/** Finishes an upload, then checks the file really is a video of an allowed size (anything else is deleted). */
export async function POST(req: Request) {
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !ownsUploadKey(user.id, parsed.data.key)) return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  const { key, uploadId, parts } = parsed.data;
  const store = await uploadStore();
  let size: number;
  try {
    size = await store.complete(
      key,
      uploadId,
      [...parts].sort((a, b) => a.partNumber - b.partNumber),
    );
  } catch {
    return NextResponse.json({ error: "The upload didn't finish. Please try again." }, { status: 409 });
  }
  const head = await store.head(key);
  if (!head || size > REEL_MAX_BYTES || !looksLikeVideo(head.start)) {
    await store.remove(key);
    return NextResponse.json({ error: size > REEL_MAX_BYTES ? "Videos can be up to 500 MB." : "That file isn't a video we can read. Upload an MP4, MOV or WebM." }, { status: 415 });
  }
  return NextResponse.json({ key, bytes: size });
}
