import { NextResponse } from "next/server";
import { z } from "zod";
import { creditsForReel, grantCredits, REEL_LANGUAGES, REEL_MAX_BYTES, REEL_MAX_SECONDS, REEL_STYLES, spendCredits, type ReelJob, type ReelLanguage, type ReelStyle } from "@launchreel/core";
import { getDb, startRender } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { looksLikeVideo, ownsUploadKey, uploadStore } from "@/lib/reel-uploads";
import { requireUser } from "@/lib/user";

const Body = z.object({
  key: z.string().max(200),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .transform((name) => name.replace(/[\u0000-\u001f\u007f/\\]/g, "").trim() || "video"), // shown as plain text, never a path
  // Measured in the browser, which sets the price; the container measures again and refuses (refunded) anything longer.
  durationSec: z.number().positive(),
  width: z.number().int().positive().max(10_000).nullable().default(null),
  height: z.number().int().positive().max(10_000).nullable().default(null),
  style: z.enum(REEL_STYLES as [ReelStyle, ...ReelStyle[]]).default("bold"),
  emojis: z.boolean().default(true),
  zooms: z.boolean().default(true),
  sfx: z.boolean().default(true),
  hook: z.boolean().default(true),
  language: z.enum(REEL_LANGUAGES as [ReelLanguage, ...ReelLanguage[]]).default("auto"),
  // Dodo Payments' policy for AI content tools, and the people in the video: the customer confirms they may use it.
  ownershipConfirmed: z.literal(true),
});

/** Makes a reel from a finished upload (/api/reels/uploads): charges its credits and starts the render. */
export async function POST(req: Request) {
  if (isDemo) return NextResponse.json({ error: "This is the demo. Connect a database and Clerk to make real reels." }, { status: 403 });
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const ownership = parsed.error.issues.some((i) => i.path[0] === "ownershipConfirmed");
    return NextResponse.json({ error: ownership ? "Confirm that you own this video and have permission from everyone in it." : "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;
  if (!ownsUploadKey(user.id, body.key)) return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  const cost = creditsForReel(body.durationSec);
  if (cost === null) return NextResponse.json({ error: `Reels can be up to ${REEL_MAX_SECONDS / 60} minutes long.` }, { status: 400 });

  const db = await getDb();
  // A double submit finds the reel already started for this upload.
  const started = await db.job.findFirst({ where: { userId: user.id, kind: "reel", status: { in: ["QUEUED", "RUNNING"] }, reel: { path: ["key"], equals: body.key } }, select: { id: true } });
  if (started) return NextResponse.json({ id: started.id });

  const upload = await (await uploadStore()).head(body.key);
  if (!upload) return NextResponse.json({ error: "We couldn't find your upload. Please upload the video again." }, { status: 404 });
  if (upload.size > REEL_MAX_BYTES || !looksLikeVideo(upload.start)) return NextResponse.json({ error: "That file isn't a video we can read. Upload an MP4, MOV or WebM." }, { status: 415 });

  const active = await db.job.count({ where: { userId: user.id, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active >= 3) return NextResponse.json({ error: "You already have 3 videos in progress" }, { status: 429 });

  const paid = await db.creditEntry.count({ where: { userId: user.id, delta: { gt: 0 }, NOT: { reason: "signup_trial" } } });
  const { width, height } = body;
  const reel: ReelJob = {
    style: body.style,
    emojis: body.emojis,
    zooms: body.zooms,
    sfx: body.sfx,
    hook: body.hook,
    language: body.language,
    key: body.key,
    fileName: body.fileName,
    bytes: upload.size,
    durationSec: Math.round(body.durationSec * 100) / 100,
    width,
    height,
  };
  const job = await db.job.create({
    data: {
      userId: user.id,
      kind: "reel",
      sourceType: "UPLOAD",
      sourceUrl: body.fileName, // what lists and the video page show for a reel
      // The reel keeps the upload's shape; the format only labels it.
      format: width && height ? (height > width * 1.15 ? "vertical" : width > height * 1.15 ? "landscape" : "square") : "vertical",
      durationSec: Math.ceil(body.durationSec),
      creditsCost: cost,
      watermark: paid === 0, // free trial: this account has never bought credits
      music: "none",
      reel,
      status: "QUEUED",
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
    console.error(`[reels] could not start render for ${job.id}`, err);
    await db.job.update({ where: { id: job.id }, data: { status: "FAILED", error: "Could not start the render", finishedAt: new Date() } });
    await grantCredits(db, user.id, cost, `refund:${job.id}`, `refund:${job.id}`);
    return NextResponse.json({ error: "Rendering is unavailable right now. Your credits were refunded." }, { status: 503 });
  }
  return NextResponse.json({ id: job.id });
}
