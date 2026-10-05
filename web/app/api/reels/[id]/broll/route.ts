import { NextResponse } from "next/server";
import { z } from "zod";
import { parseClip, parseReel, reelEditable, type BrollClip } from "@launchreel/core";
import { getDb } from "@/lib/db";
import { demoJobs, isDemo } from "@/lib/demo";
import { searchStock } from "@/lib/reel-assistant";
import { requireUser } from "@/lib/user";

const Body = z.object({ query: z.string().trim().min(2).max(80), portrait: z.boolean() });

// Searches are free, but Pexels allows the whole app 200 an hour: per person, in each Worker instance (best effort).
const WINDOW_MS = 10 * 60_000;
const PER_WINDOW = 20;
const recent = new Map<string, number[]>();
function allowed(userId: string) {
  const now = Date.now();
  const times = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= PER_WINDOW) return false;
  recent.set(userId, [...times, now]);
  return true;
}

/** Stock B-roll for the editor: Pexels clips for a search, through the render Worker (it holds the key). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Type a couple of words to search for." }, { status: 400 });
  const job = isDemo ? (demoJobs().find((j) => j.id === id && j.kind === "reel") ?? null) : await (await getDb()).job.findFirst({ where: { id, userId: user.id, kind: "reel" } });
  const reel = job ? parseReel(job.reel) : null;
  if (!job || !reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  const editable = reelEditable(job, reel);
  if (!editable.ok && !isDemo) return NextResponse.json({ error: editable.reason }, { status: 400 });
  if (!allowed(user.id)) return NextResponse.json({ error: "That's a lot of searches in a few minutes. Give it a moment, then search again." }, { status: 429 });

  try {
    const answer = await searchStock(parsed.data.query, parsed.data.portrait);
    if (!answer) return NextResponse.json({ error: "Stock footage isn't available here yet." }, { status: 503 });
    const clips = answer.clips.map((c) => parseClip(c)).filter((c): c is BrollClip => c !== null);
    if (!clips.length && answer.error) {
      const status = answer.status === 429 || answer.status === 503 ? answer.status : 502;
      return NextResponse.json({ error: status === 502 ? "The stock search didn't answer. Try again in a moment." : answer.error }, { status });
    }
    return NextResponse.json({ clips });
  } catch (err) {
    console.error(`[reel-broll] ${id}`, err);
    return NextResponse.json({ error: "The stock search didn't answer. Try again in a moment." }, { status: 502 });
  }
}
