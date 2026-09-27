import { NextResponse } from "next/server";
import { z } from "zod";
import { creditsFor, grantCredits, spendCredits } from "@launchreel/core";
import { getDb, startRender } from "@/lib/db";
import { githubVisibility, websiteProblem } from "@/lib/preflight";
import { isDemo } from "@/lib/demo";
import { requireUser } from "@/lib/user";

const GITHUB_REPO = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;

const Body = z.object({
  sourceUrl: z.string().url().max(500),
  tone: z.string().max(120).optional(),
  format: z.enum(["landscape", "vertical", "square"]).default("landscape"),
  durationSec: z.number().int().min(10).max(90).default(20), // up to 30s: teaser; 60–90s: full launch video
  notes: z.string().max(1000).optional(),
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

  const db = await getDb();
  // Repos GitHub doesn't show publicly are downloaded with the customer's saved token (encrypted; see Settings).
  // With a token saved, an inconclusive check also uses it, since the token can read public repos too.
  let privateRepo = false;
  if (isGithub) {
    const visibility = await githubVisibility(body.sourceUrl);
    const hasToken = visibility !== "public" && (await db.repoToken.count({ where: { userId: user.id } })) > 0;
    if (visibility === "hidden" && !hasToken) {
      return NextResponse.json({ error: "We couldn't find that repository. If it's private, add a GitHub token in Settings → Private repositories." }, { status: 422 });
    }
    privateRepo = hasToken;
  } else {
    const problem = await websiteProblem(body.sourceUrl);
    if (problem) return NextResponse.json({ error: problem }, { status: 422 });
  }

  const active = await db.job.count({ where: { userId: user.id, status: { in: ["QUEUED", "RUNNING"] } } });
  if (active >= 3) return NextResponse.json({ error: "You already have 3 videos in progress" }, { status: 429 });

  const paid = await db.creditEntry.count({ where: { userId: user.id, delta: { gt: 0 }, NOT: { reason: "signup_trial" } } });
  const cost = creditsFor("newVideo", body.durationSec);
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
      watermark: user.plan === "FREE" && paid === 0,
      privateRepo,
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
  const jobs = await (await getDb()).job.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, status: true, sourceUrl: true, tone: true, format: true, videoUrl: true, posterUrl: true, shareCopy: true, error: true, createdAt: true, parentJobId: true },
  });
  return NextResponse.json({ jobs, credits: user.credits });
}
