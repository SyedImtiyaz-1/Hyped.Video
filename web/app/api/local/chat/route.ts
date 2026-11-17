import { NextResponse } from "next/server";
import { CHAT_SCHEMA, chatContext, chatMessages, needsFootage, parseChatOps, parseReelEdit, REEL_PLAN_MODEL } from "@launchreel/core";
import { ChatBody, withSelection } from "@/lib/chat-body";
import { openaiBase, openaiKey } from "@/lib/local-openai";
import { requireUser } from "@/lib/user";

/**
 * Local development only: Ask AI on a clip opened from this computer (/dashboard/edit/local), which has no reel on the
 * server and no render Worker to ask. The same call the render Worker's ReelAssistant makes (render/src/index.ts,
 * reelChat: the plan's small model, CHAT_SYSTEM, the reel_chat schema), with the root .env's OPENAI_API_KEY, and its
 * changes checked as /api/reels/[id]/chat checks them. Stock B-roll is searched by the render Worker, so those changes
 * are left out and said. Never in a production build: the web app holds no model key there.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  await requireUser();
  const key = openaiKey();
  if (!key) return NextResponse.json({ error: "Add OPENAI_API_KEY to the root .env to use Ask AI here." }, { status: 503 });
  const parsed = ChatBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That message couldn't be read." }, { status: 400 });
  const edit = parseReelEdit(parsed.data.draft.edit);
  if (!edit) return NextResponse.json({ error: "Ask AI needs your clip's words: wait for its captions, then ask again." }, { status: 400 });
  const draft = { options: parsed.data.draft.options, edit };

  const res = await fetch(`${openaiBase()}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: REEL_PLAN_MODEL,
      reasoning_effort: "low",
      messages: chatMessages(withSelection(chatContext(draft, parsed.data.time), parsed.data.selection), parsed.data.message, parsed.data.history),
      response_format: { type: "json_schema", json_schema: { name: "reel_chat", strict: true, schema: CHAT_SCHEMA } },
    }),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: `The assistant didn't answer (${res?.status ?? "offline"}). Try again in a moment.` }, { status: 502 });

  const body = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
  let answer: { reply?: unknown; ops?: unknown };
  try {
    answer = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "The assistant's answer couldn't be read. Try again." }, { status: 502 });
  }
  const checked = parseChatOps(Array.isArray(answer.ops) ? answer.ops : [], edit);
  const ops = checked.filter((op) => !needsFootage(op));
  const reply = String(answer.reply ?? "").slice(0, 600) || (ops.length ? "Done." : "I couldn't make that change.");
  const skipped = checked.length > ops.length ? " Stock B-roll needs the clip uploaded, so I left that out." : "";
  return NextResponse.json({ reply: reply + skipped, ops });
}
