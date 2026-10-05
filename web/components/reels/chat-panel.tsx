"use client";
import { ArrowUp, LoaderCircle, Sparkles, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type ChatMessage = { from: "you" | "ai"; text: string; changes?: number; failed?: boolean };

const SUGGESTIONS = ["Make the captions yellow", "Cut the long pauses", "Add calm music under my voice", "Remove all the emojis", "Punch in on every number", "Add a flash when I say the key point"];

/**
 * Editing by typing: what the customer asks, and what the assistant changed. Each answer's changes are one step the
 * editor can undo; nothing is saved until export.
 */
export function ChatPanel({ messages, busy, onSend, onUndo }: { messages: ChatMessage[]; busy: boolean; onSend: (text: string) => void; onUndo: () => void }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  // Newest at the bottom, in view (scrollTo returns a promise in newer browsers: an effect must return nothing).
  useEffect(() => {
    void list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy]);
  const send = (value: string) => {
    const clean = value.trim();
    if (!clean || busy) return;
    onSend(clean);
    setText("");
  };
  const lastChange = messages.map((m) => m.from === "ai" && (m.changes ?? 0) > 0).lastIndexOf(true);
  return (
    <div className="flex flex-col gap-3">
      <div ref={list} className="max-h-[420px] min-h-[140px] space-y-2 overflow-y-auto rounded-lg border border-gray-alpha-400 p-3" aria-live="polite">
        {messages.length === 0 ? (
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-gray-1000">
              <Sparkles className="size-3.5" />
              Tell it what to change
            </p>
            <p className="mt-0.5 text-[13px] text-gray-900">Captions, cuts, emojis, punch-ins, sounds, effects, music, the hook or the look. You can undo each answer.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} disabled={busy} className="h-8 rounded-full border border-gray-alpha-400 px-3 text-[13px] text-gray-1000 hover:bg-gray-alpha-100 disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={cn("flex", m.from === "you" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed", m.from === "you" ? "bg-gray-1000 text-background-100" : m.failed ? "border border-red-500/40 text-red-900" : "bg-gray-alpha-100 text-gray-1000")}>
                {m.text}
                {m.from === "ai" && (m.changes ?? 0) > 0 && (
                  <span className="mt-1.5 flex items-center gap-2 text-xs text-gray-900">
                    {m.changes} {m.changes === 1 ? "change" : "changes"}
                    {i === lastChange && (
                      <button type="button" onClick={onUndo} className="flex items-center gap-1 font-medium text-gray-1000 underline-offset-2 hover:underline">
                        <Undo2 className="size-3" />
                        Undo
                      </button>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="flex items-center gap-2 text-[13px] text-gray-900">
            <LoaderCircle className="size-3.5 animate-spin" />
            Working on it…
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-end gap-2 rounded-lg border border-gray-alpha-400 bg-background-100 p-1.5 focus-within:border-gray-1000"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(text);
            }
          }}
          rows={2}
          maxLength={1000}
          placeholder="Make the captions bigger and add a whoosh when I say pricing"
          aria-label="What to change"
          className="min-h-[44px] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-gray-1000 outline-none placeholder:text-gray-900"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gray-1000 text-background-100 disabled:opacity-40">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </form>
    </div>
  );
}
