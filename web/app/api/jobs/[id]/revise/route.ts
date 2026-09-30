import { NextResponse } from "next/server";
import { z } from "zod";
import { creditsFor, grantCredits, spendCredits, type Quality } from "@launchreel/core";
import { getDb, startRender } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { STUDIO_SOON_ERROR, studioAvailable } from "@/lib/studio";
import { requireUser } from "@/lib/user";

const Body = z.object({ change: z.string().min(3).max(1000) });

// "Make the hook punchier", "swap to vertical", "use our tagline in the outro"
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isDemo) return NextResponse.json({ error: "This is the demo. Revisions are disabled." }, { status: 403 });
  const user = await requireUser();
  const { id } = await params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Describe the change" }, { status: 400 });

  const db = await getDb();
  const parent = await db.job.findFirst({ where: { id, userId: user.id, status: "SUCCEEDED" } });
  if (!parent) return NextResponse.json({ error: "Video not found" }, { status: 404 });
  // A reel re-runs from its upload, which is deleted once it's made; there's nothing to revise.
  if (parent.kind === "reel") return NextResponse.json({ error: "Reels can't be revised. Upload the video again with the options you want." }, { status: 400 });
  if (parent.quality === "studio" && !(await studioAvailable())) return NextResponse.json({ error: "Studio is coming soon, so Studio videos can't be revised right now." }, { status: 400 });

  // A revision stays on its video's quality tier, so it renders on the same engine.
  const cost = creditsFor("revision", parent.durationSec, parent.quality as Quality);
  const job = await db.job.create({
    data: {
      userId: user.id,
      parentJobId: parent.id,
      sourceType: parent.sourceType,
      sourceUrl: parent.sourceUrl,
      tone: parent.tone,
      format: parent.format,
      durationSec: parent.durationSec,
      notes: parsed.data.change,
      creditsCost: cost,
      watermark: parent.watermark,
      privateRepo: parent.privateRepo,
      videoType: parent.videoType,
      music: parent.music,
      brief: parent.brief ?? undefined,
      quality: parent.quality,
      voice: parent.voice,
      captions: parent.captions,
    },
  });
  try {
    await spendCredits(db, user.id, cost, `job:${job.id}`);
  } catch {
    await db.job.delete({ where: { id: job.id } });
    return NextResponse.json({ error: "Not enough credits", upgrade: true }, { status: 402 });
  }
  try {
    await startRender(job.id);
  } catch (err) {
    console.error(`[revise] could not start render for ${job.id}`, err);
    await db.job.update({ where: { id: job.id }, data: { status: "FAILED", error: "Could not start the render", finishedAt: new Date() } });
    await grantCredits(db, user.id, cost, `refund:${job.id}`, `refund:${job.id}`);
    return NextResponse.json({ error: "Rendering is unavailable right now. Your credits were refunded." }, { status: 503 });
  }
  return NextResponse.json({ id: job.id });
}
