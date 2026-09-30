import { NextResponse } from "next/server";
import { REEL_MAX_BYTES, REEL_PART_BYTES } from "@launchreel/core/reel";
import { ownsUploadKey, uploadStore } from "@/lib/reel-uploads";
import { requireUser } from "@/lib/user";

const MAX_PARTS = Math.ceil(REEL_MAX_BYTES / REEL_PART_BYTES);

/** One part of an upload, as the request body: ?key=…&uploadId=…&part=1… Every part but the last is REEL_PART_BYTES. */
export async function PUT(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const uploadId = url.searchParams.get("uploadId") ?? "";
  const part = Number(url.searchParams.get("part"));
  if (!ownsUploadKey(user.id, key) || !uploadId || !Number.isInteger(part) || part < 1 || part > MAX_PARTS) return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  // Refused before reading when the browser says the part is too big; checked again once it's read.
  if (Number(req.headers.get("content-length")) > REEL_PART_BYTES) return NextResponse.json({ error: "Upload parts are 8 MB at most" }, { status: 413 });
  const body = await req.arrayBuffer();
  if (!body.byteLength || body.byteLength > REEL_PART_BYTES) return NextResponse.json({ error: "Upload parts are 8 MB at most" }, { status: 413 });
  return NextResponse.json(await (await uploadStore()).part(key, uploadId, part, body));
}
