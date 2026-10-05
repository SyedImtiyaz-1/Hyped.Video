import { NextResponse } from "next/server";
import { z } from "zod";
import { chatContext, parseChatOps, parseLookChanges, parseReel, parseReelEdit, REEL_FONTS, REEL_MAX_FONTS, REEL_STYLES, reelEditable, type ReelFont, type ReelStyle } from "@launchreel/core";
import { getDb } from "@/lib/db";
import { demoJobs, isDemo } from "@/lib/demo";
import { askAssistant } from "@/lib/reel-assistant";
import { readEdit } from "@/lib/reel-edits";
import { requireUser } from "@/lib/user";

const Body = z.object({
  message: z.string().trim().min(1).max(1000),
  time: z.number().min(0).default(0),
  draft: z.object({
    options: z.object({
      style: z.enum(REEL_STYLES as [ReelStyle, ...ReelStyle[]]),
      look: z.unknown().optional().transform((look) => parseLookChanges(look)),
      fonts: z
        .array(z.enum(REEL_FONTS as [ReelFont, ...ReelFont[]]))
        .min(1)
        .max(REEL_MAX_FONTS),
      emojis: z.boolean(),
      zooms: z.boolean(),
      sfx: z.boolean(),
      hook: z.boolean(),
    }),
    edit: z.unknown(),
  }),
});

// Chat edits are free, but not unlimited: per person, in each Worker instance (a best-effort guard against loops).
const WINDOW_MS = 10 * 60_000;
const PER_WINDOW = 30;
const recent = new Map<string, number[]>();
function allowed(userId: string) {
  const now = Date.now();
  const times = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= PER_WINDOW) return false;
  recent.set(userId, [...times, now]);
  return true;
}

/**
 * A chat edit: the customer's message and their current draft to the assistant (the render Worker's ReelAssistant),
 * and its reply and changes back, checked against the draft (parseChatOps). The editor applies them as one step it can
 * undo; nothing is saved until the customer exports.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That message couldn't be read." }, { status: 400 });
  const job = isDemo ? (demoJobs().find((j) => j.id === id && j.kind === "reel") ?? null) : await (await getDb()).job.findFirst({ where: { id, userId: user.id, kind: "reel" } });
  const reel = job ? parseReel(job.reel) : null;
  if (!job || !reel) return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  const editable = reelEditable(job, reel);
  if (!editable.ok && !isDemo) return NextResponse.json({ error: editable.reason }, { status: 400 });
  if (!allowed(user.id)) return NextResponse.json({ error: "That's a lot of changes in a few minutes. Give it a moment, then ask again." }, { status: 429 });

  const original = await readEdit(id);
  const edit = original && parseReelEdit(parsed.data.draft.edit, original);
  if (!edit) return NextResponse.json({ error: "The reel's edits couldn't be read. Reload the editor and try again." }, { status: 400 });
  const draft = { options: parsed.data.draft.options, edit };
  try {
    const answer = await askAssistant(chatContext(draft, parsed.data.time), parsed.data.message);
    if (!answer) return NextResponse.json({ error: "Chat edits aren't available here yet." }, { status: 503 });
    const ops = parseChatOps(answer.ops, edit);
    console.log(`[reel-chat] ${id}: ${ops.length} changes, ${answer.inputTokens}+${answer.outputTokens} tokens`);
    return NextResponse.json({ reply: answer.reply || (ops.length ? "Done." : "I couldn't make that change."), ops });
  } catch (err) {
    console.error(`[reel-chat] ${id}`, err);
    return NextResponse.json({ error: "The assistant didn't answer. Try again in a moment." }, { status: 502 });
  }
}
