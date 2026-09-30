import { NextResponse } from "next/server";
import { z } from "zod";
import { creditsFor, grantCredits, MUSIC_CHOICES, QUALITIES, spendCredits, templateById, VIDEO_TYPES, VOICE_IDS, type MusicChoice, type Quality, type VideoType } from "@launchreel/core";
import { getDb, startRender } from "@/lib/db";
import { githubVisibility, websiteProblem } from "@/lib/preflight";
import { isDemo } from "@/lib/demo";
import { STUDIO_SOON_ERROR, studioAvailable } from "@/lib/studio";
import { requireUser } from "@/lib/user";

const GITHUB_REPO = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

const Body = z.object({
  sourceUrl: z.string().url().max(500),
  tone: z.string().max(120).optional(),
  format: z.enum(["landscape", "vertical", "square"]).default("landscape"),
  durationSec: z.number().int().min(10).max(90).default(20), // up to 30s: teaser; 60–90s: full launch video
  notes: z.string().max(1000).optional(),
  videoType: z.enum(VIDEO_TYPES as [VideoType, ...VideoType[]]).default("launch"),
  music: z.enum(MUSIC_CHOICES as [MusicChoice, ...MusicChoice[]]).default("upbeat"),
  quality: z.enum(QUALITIES as [Quality, ...Quality[]]).default("standard"),
  // Voiceover: one of our voices, or null for none. Captions are burned in unless turned off (SRT either way).
  voice: z.enum(VOICE_IDS).nullable().default(null),
  captions: z.boolean().default(true),
  // A template id from TEMPLATES; unknown ids are dropped rather than refused.
  template: z.string().max(40).optional(),
  // Optional guided brief: short free text, so the agent gets what the customer actually wants to say.
  brief: z
    .object({
      launching: z.string().trim().max(200).optional(),
      audience: z.string().trim().max(200).optional(),
      highlights: z.array(z.string().trim().min(1).max(160)).max(3).optional(),
      cta: z.string().trim().max(160).optional(),
    })
    .optional(),
  // Dodo Payments' policy for AI content tools: customers may only submit products they own or may promote.
  ownershipConfirmed: z.literal(true),
});

export async function POST(req: Request) {
  if (isDemo) return NextResponse.json({ error: "This is the demo. Connect a database and Clerk to make real videos." }, { status: 403 });
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    const ownership = parsed.error.issues.some((i) => i.path[0] === "ownershipConfirmed");
    return NextResponse.json({ error: ownership ? "Confirm that you own this product or may promote it." : "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  const url = new URL(body.sourceUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") return NextResponse.json({ error: "URL must be http(s)" }, { status: 400 });
  // Cheap SSRF guard; the worker's network policy must also block private ranges.
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/.test(url.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
    return NextResponse.json({ error: "Use a public domain" }, { status: 400 });
  }
  const isGithub = url.hostname === "github.com";
  if (isGithub && !GITHUB_REPO.test(body.sourceUrl)) {
    return NextResponse.json({ error: "Use a repo URL like https://github.com/owner/repo" }, { status: 400 });
  }

  if (body.quality === "studio" && !(await studioAvailable())) return NextResponse.json({ error: STUDIO_SOON_ERROR }, { status: 400 });

  const db = await getDb();
  // Repos GitHub doesn't show publicly are downloaded with the customer's saved token (encrypted; see Settings).
  // With a token saved, an inconclusive check also uses it, since the token can read public repos too.
  let privateRepo = false;
  if (isGithub) {
    const visibility = await githubVisibility(body.sourceUrl);
    const hasToken = visibility !== "public" && (await db.repoToken.count({ where: { userId: user.id } })) > 0;
    if (visibility === "hidden" && !hasToken) {
      return NextResponse.json({ error: "We couldn't find that repository. If it's private, paste a GitHub token in the field under the repo link." }, { status: 422 });
    }
    privateRepo = hasToken;
  } else {
    const problem = await websiteProblem(body.sourceUrl);
    if (problem) return NextResponse.json({ error: problem }, { status: 422 });
  }

  const active = await db.job.count({ where: { userId: user.id, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active >= 3) return NextResponse.json({ error: "You already have 3 videos in progress" }, { status: 429 });

  const paid = await db.creditEntry.count({ where: { userId: user.id, delta: { gt: 0 }, NOT: { reason: "signup_trial" } } });
  const cost = creditsFor("newVideo", body.durationSec, body.quality);
  const job = await db.job.create({
    data: {
      userId: user.id,
      sourceType: isGithub ? "GITHUB" : "WEBSITE",
      sourceUrl: body.sourceUrl,
      tone: body.tone,
      format: body.format,
      durationSec: body.durationSec,
      notes: body.notes,
      creditsCost: cost,
      watermark: paid === 0, // free trial: this account has never bought credits
      privateRepo,
      videoType: body.videoType,
      music: body.music,
      quality: body.quality,
      voice: body.voice,
      captions: body.captions,
      template: templateById(body.template)?.id ?? null,
      brief: body.brief && Object.values(body.brief).some((v) => (Array.isArray(v) ? v.length : v)) ? body.brief : undefined,
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
    console.error(`[jobs] could not start render for ${job.id}`, err);
    await db.job.update({ where: { id: job.id }, data: { status: "FAILED", error: "Could not start the render", finishedAt: new Date() } });
    await grantCredits(db, user.id, cost, `refund:${job.id}`, `refund:${job.id}`);
    return NextResponse.json({ error: "Rendering is unavailable right now. Your credits were refunded." }, { status: 503 });
  }
  return NextResponse.json({ id: job.id });
}

export async function GET() {
  const user = await requireUser();
  const jobs = await (
    await getDb()
  ).job.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, status: true, sourceUrl: true, tone: true, format: true, videoUrl: true, posterUrl: true, shareCopy: true, error: true, createdAt: true, parentJobId: true },
  });
  return NextResponse.json({ jobs, credits: user.credits });
}
