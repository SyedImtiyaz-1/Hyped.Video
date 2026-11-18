"use client";
import { CHAT_WORDS, type ChatLang } from "./chat-lang";
import { ArrowUp, Check, ChevronRight, Copy, LoaderCircle, Undo2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { cn } from "@/lib/cn";

/**
 * One step of the assistant's work on an answer: what it did, and its details. `status`, while it works: done (the
 * default), the one under way, or one still to come.
 */
export type WorkStep = { title: string; items?: string[]; status?: "done" | "active" | "pending" };
/**
 * A message: what the customer asked, or the assistant's answer with what it changed (`step`: the editor's id for it)
 * and how it got there (`work`: how long it took and its steps, behind "Worked for 4s", as Cardboard's chat shows it).
 */
export type ChatMessage = { from: "you" | "ai"; text: string; changes?: string[]; step?: number; failed?: boolean; work?: { ms: number; steps: WorkStep[] }; lang?: ChatLang };

/** How long the assistant worked: "4s", "1m 12s". */
export function workTime(ms: number) {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** A quote of what was asked, for a work step: one line, at most 80 characters. */
export const quoted = (text: string) => `“${text.length > 80 ? `${text.slice(0, 79)}…` : text}”`;

// The box grows with what's typed, up to this many lines, then scrolls.
const MAX_LINES = 6;

/**
 * Editing by typing: what the customer asks, and what the assistant changed, a short list under each answer with Undo
 * this (it takes back that answer alone; `canUndo` says whether there's anything left to take back). Nothing is saved
 * until export. Blank until the first message, the box too, as Cardboard's chat (Taibanaz, 3 Nov). `draft`: a request
 * typed in beforehand, waiting to be sent. `context`: what the assistant will look at (the playhead, what's selected),
 * shown over the box. `fill`: as tall as its column, the messages taking the room. `live`: while it works, its steps as
 * they happen (done, under way, to come), as Claude's and Cardboard's chats show them.
 */
export function ChatPanel({
  messages,
  busy,
  live,
  onSend,
  onUndo,
  canUndo,
  draft,
  context,
  inputRef,
  fill,
}: {
  messages: ChatMessage[];
  busy: boolean;
  live?: WorkStep[] | null;
  onSend: (text: string) => void;
  onUndo: (message: ChatMessage) => void;
  canUndo: (message: ChatMessage) => boolean;
  draft?: string;
  context?: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  fill?: boolean;
}) {
  const [text, setText] = useState(draft ?? "");
  const list = useRef<HTMLDivElement>(null);
  const own = useRef<HTMLTextAreaElement>(null);
  const box = inputRef ?? own;
  // Newest at the bottom, in view (scrollTo returns a promise in newer browsers: an effect must return nothing).
  useEffect(() => {
    void list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy, live?.length]);
  // The box's height follows its text.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, line * MAX_LINES + 8)}px`;
  }, [text, box]);
  // Its own words (Worked for, Undo this) in the language of the message they answer; while it works, the last asked.
  const asked = [...messages].reverse().find((m) => m.from === "you")?.lang ?? "en";
  const send = (value: string) => {
    const clean = value.trim();
    if (!clean || busy) return;
    onSend(clean);
    setText("");
  };
  return (
    <div className={cn("flex flex-col gap-3", fill && "h-full")}>
      {/* As Cardboard's chat: no box around it; your messages in a grey bubble on the right, its answers as plain text. */}
      <div ref={list} className={cn("min-h-[140px] space-y-4 overflow-y-auto px-1 py-1", fill ? "max-h-[420px] flex-1 lg:max-h-none" : "max-h-[420px]")} aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={cn("group flex flex-col", m.from === "you" ? "items-end" : "items-start")}>
            {m.from === "ai" && m.work && <Worked work={m.work} lang={m.lang ?? "en"} />}
            <div className={cn("text-[13px] leading-relaxed [overflow-wrap:anywhere]", m.from === "you" ? "max-w-[85%] rounded-2xl bg-gray-alpha-200 px-3.5 py-2 text-gray-1000" : m.failed ? "rounded-lg border border-red-500/40 px-3 py-2 text-red-900" : "w-full text-gray-1000")}>
              {m.text}
              {m.from === "ai" && Boolean(m.changes?.length) && (
                <>
                  <ul className="mt-1.5 space-y-0.5 border-t border-gray-alpha-300 pt-1.5 text-xs text-gray-900">
                    {m.changes!.map((c) => (
                      <li key={c} className="flex items-center gap-1.5">
                        <Check className="size-3 shrink-0" />
                        {c}
                      </li>
                    ))}
                  </ul>
                  {canUndo(m) ? (
                    <button type="button" onClick={() => onUndo(m)} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-gray-1000 underline-offset-2 hover:underline">
                      <Undo2 className="size-3" />
                      {CHAT_WORDS[m.lang ?? "en"].undo}
                    </button>
                  ) : (
                    <span className="mt-1.5 block text-xs text-gray-900">{CHAT_WORDS[m.lang ?? "en"].undone}</span>
                  )}
                </>
              )}
            </div>
            {m.from === "ai" && !m.failed && <CopyAnswer text={m.text} />}
          </div>
        ))}
        {busy && <Working steps={live} lang={asked} />}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="rounded-2xl border border-editor-line bg-editor-stage p-2 transition-colors focus-within:border-gray-alpha-600"
      >
        {/* As Cardboard's: a tall box to type in, then a row under it with what it'll look at and the round send button. */}
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          rows={4}
          maxLength={1000}
          aria-label="Ask AI"
          className="min-h-[96px] w-full resize-none bg-transparent px-1.5 py-1 text-sm text-gray-1000 outline-none"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate px-1.5 text-[11px] text-gray-900">{context}</p>
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gray-1000 text-background-100 transition-opacity disabled:opacity-30">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

// The sweep of light across the step under way ("Looking in Downloads…"), as Claude's and Cardboard's chats have it.
const SHIMMER = "animate-shimmer bg-[linear-gradient(90deg,var(--color-gray-900)_35%,var(--color-gray-1000)_50%,var(--color-gray-900)_65%)] bg-[length:200%_100%] bg-clip-text text-transparent";

/**
 * While the assistant works: one line, "Working for 12s ›", shimmering, as Cardboard's chat has it; a click opens its
 * steps as they happen (done, under way, to come), another closes them.
 */
function Working({ steps, lang }: { steps?: WorkStep[] | null; lang: ChatLang }) {
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(started);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Fold label={<span className={SHIMMER}>{CHAT_WORDS[lang].workingFor(workTime(now - started))}</span>} steps={steps ?? []} lang={lang} live />
  );
}

/** "Worked for 4s ›" over an answer, closed; a click opens the steps the assistant took. */
function Worked({ work, lang }: { work: NonNullable<ChatMessage["work"]>; lang: ChatLang }) {
  return <Fold label={CHAT_WORDS[lang].workedFor(workTime(work.ms))} steps={work.steps} lang={lang} />;
}

/** A line that opens the assistant's steps under it, and closes them again. `live`: they're still happening. */
function Fold({ label, steps, lang, live }: { label: React.ReactNode; steps: WorkStep[]; lang: ChatLang; live?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("max-w-[85%]", !live && "mb-1.5")} role={live ? "status" : undefined}>
      <button type="button" onClick={() => setOpen((o) => !o)} disabled={!steps.length} aria-expanded={open} className="flex items-center gap-1 text-[13px] text-gray-900 transition-colors hover:text-gray-1000 disabled:cursor-default">
        {label}
        {steps.length > 0 && <ChevronRight className={cn("size-3.5 transition-transform duration-200", open && "rotate-90")} />}
      </button>
      {/* Its height eases open and closed (a grid row from 0fr to 1fr). */}
      <div className={cn("grid transition-[grid-template-rows,opacity] duration-200 ease-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden" aria-hidden={!open}>
          <Chain steps={steps} lang={lang} />
        </div>
      </div>
    </div>
  );
}

/**
 * The assistant's steps as a chain: a tick for each step done, a spinner for the one under way (its title shimmering,
 * "In progress" beside it), an empty ring for those to come, a line joining them, their details as dots under each.
 * The look follows odysseyui's Thought Chain on 21st.dev (the component Syed sent, 3 Nov), drawn with our own tokens
 * and no extra packages.
 */
function Chain({ steps, lang }: { steps: WorkStep[]; lang: ChatLang }) {
  return (
    <ol>
      {steps.map((step, i) => {
        const status = step.status ?? "done";
        return (
          <li key={i} className="flex gap-3 pt-2 motion-safe:animate-word-in">
            <div className="flex shrink-0 flex-col items-center">
              {status === "done" ? (
                <span className="flex size-4 items-center justify-center rounded-full bg-gray-1000 text-background-100">
                  <Check className="size-2.5" strokeWidth={3} />
                </span>
              ) : status === "active" ? (
                <LoaderCircle className="size-4 animate-spin text-gray-1000" />
              ) : (
                <span className="size-4 rounded-full border border-gray-alpha-500" />
              )}
              {i < steps.length - 1 && <span className={cn("mt-1 w-px flex-1", status === "done" ? "bg-gray-alpha-600" : "bg-gray-alpha-400")} />}
            </div>
            <div className="min-w-0 pb-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium leading-4">
                <span className={status === "active" ? SHIMMER : status === "pending" ? "text-gray-900" : "text-gray-1000"}>{step.title}</span>
                {status === "active" && <span className="rounded-full border border-gray-alpha-400 px-1.5 py-px text-[10px] font-normal text-gray-900">{CHAT_WORDS[lang].inProgress}</span>}
              </p>
              {status !== "pending" &&
                step.items?.map((item, k) => (
                  <p key={k} className="mt-1 flex gap-2 text-xs leading-relaxed text-gray-900 [overflow-wrap:anywhere]">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-gray-alpha-500" />
                    {item}
                  </p>
                ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Under an answer, as Cardboard's chat: copy its text. */
function CopyAnswer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  return (
    <button type="button" onClick={copy} aria-label={copied ? "Copied" : "Copy the answer"} title={copied ? "Copied" : "Copy"} className="mt-1 flex size-6 items-center justify-center rounded-md text-gray-900 opacity-70 transition hover:bg-gray-alpha-100 hover:text-gray-1000 hover:opacity-100">
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}
