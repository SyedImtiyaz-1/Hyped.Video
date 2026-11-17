import { NextResponse } from "next/server";
import { BROLL_LENGTH, chatContext, cleanChatHistory, longestShot, needsFootage, parseChatOps, parseClip, parseReel, parseReelEdit, reelEditable, sameClip, type BrollClip, type ChatOp, type ReelEdit } from "@launchreel/core";
import { ChatBody as Body, withSelection } from "@/lib/chat-body";
import { chatAllowed as allowed } from "@/lib/chat-limit";
import { getDb } from "@/lib/db";
import { demoJobs, isDemo } from "@/lib/demo";
import { askAssistant, searchStock } from "@/lib/reel-assistant";
import { readEdit } from "@/lib/reel-edits";
import { requireUser } from "@/lib/user";

/**
 * B-roll the assistant asked for, found: a stock search for each (four at most a message), and its first clip that's
 * long enough and not in the reel yet attached to the change. A change whose search finds nothing is dropped, and said.
 */
async function withFootage(ops: ChatOp[], edit: ReelEdit): Promise<{ ops: ChatOp[]; missing: string[] }> {
  const used: BrollClip[] = edit.broll.map((s) => s.clip);
  const portrait = edit.height > edit.width;
  const out: ChatOp[] = [];
  const missing: string[] = [];
  let searches = 0;
  for (const op of ops) {
    if (!needsFootage(op)) {
      out.push(op);
      continue;
    }
    const answer = searches++ < 4 ? await searchStock(op.query, portrait).catch(() => null) : null;
    const need = op.op === "add_broll" ? (op.length ?? BROLL_LENGTH.default) : BROLL_LENGTH.min;
    const clip = (answer?.clips ?? []).map((c) => parseClip(c)).find((c): c is BrollClip => c !== null && longestShot(c) >= need && !used.some((u) => sameClip(u, c)));
    if (!clip) {
      missing.push(op.query);
      continue;
    }
    used.push(clip);
    out.push({ ...op, clip });
  }
  return { ops: out, missing };
}

/**
 * A chat edit: the customer's message and their current draft to the assistant (the render Worker's ReelAssistant),
 * and its reply and changes back, checked against the draft (parseChatOps), with stock footage found for any B-roll it
 * asked for. The editor applies them as one step it can undo; nothing is saved until the customer exports.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That message couldn't be read." }, { status: 400 });
  const job = isDemo ? (demoJobs().find((j) => j.id === id && j.kind === "reel") ?? null) : await (await getDb()).job.findFirst({ where: { id, userId: user.id, kind: { in: ["reel", "video"] } } });
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
    const answer = await askAssistant(withSelection(chatContext(draft, parsed.data.time, reel.video), parsed.data.selection), parsed.data.message, cleanChatHistory(parsed.data.history));
    if (!answer) return NextResponse.json({ error: "Chat edits aren't available here yet." }, { status: 503 });
    const checked = parseChatOps(answer.ops, edit, reel.video);
    const { ops, missing } = checked.some(needsFootage) ? await withFootage(checked, edit) : { ops: checked, missing: [] };
    console.log(`[reel-chat] ${id}: ${ops.length} changes, ${answer.inputTokens}+${answer.outputTokens} tokens`);
    const reply = answer.reply || (ops.length ? "Done." : "I couldn't make that change.");
    return NextResponse.json({ reply: missing.length ? `${reply} I couldn't find stock footage for ${missing.map((q) => `"${q}"`).join(", ")}.` : reply, ops });
  } catch (err) {
    console.error(`[reel-chat] ${id}`, err);
    return NextResponse.json({ error: "The assistant didn't answer. Try again in a moment." }, { status: 502 });
  }
}
