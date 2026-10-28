import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { DEMO_PREVIEW, previewResponse } from "@/lib/reel-edits";
import { requireUser } from "@/lib/user";

/** A reel's clean preview (no captions) for the editor, to its owner, in ranges so the player can seek. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isDemo) return NextResponse.redirect(new URL(DEMO_PREVIEW, req.url));
  const user = await requireUser();
  const { id } = await params;
  const db = await getDb();
  const job = await db.job.findFirst({ where: { id, userId: user.id, kind: "reel" }, select: { id: true } });
  if (!job) return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  return (await previewResponse(id, req)) ?? NextResponse.json({ error: "This reel has no preview to edit on." }, { status: 404 });
}
