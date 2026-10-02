"use client";
import { Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { CaptionLine } from "@launchreel/core/captions";
import type { EmojiPlace, EmojiSize, EmojiStyle, ReelEdit } from "@launchreel/core/reel";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { EmojiPicker } from "./emoji-picker";

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const SIZES: [string, EmojiSize][] = [
  ["Small", "s"],
  ["Medium", "m"],
  ["Large", "l"],
];
const PLACES: [string, EmojiPlace][] = [
  ["Auto", "auto"],
  ["Above", "above"],
  ["Below", "below"],
];

export type EmojiActions = {
  set: (word: number, emoji: string | null) => void;
  setStyle: (patch: Partial<EmojiStyle>) => void;
  setOn: (on: boolean) => void;
  seek: (t: number) => void;
};

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: [string, T][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex h-8 items-center gap-0.5 rounded-md border border-gray-alpha-400 bg-background-100 p-0.5" role="radiogroup" aria-label={label}>
      {options.map(([name, v]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={cn("h-full flex-1 rounded px-2 text-[13px]", value === v ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000")}>
          {name}
        </button>
      ))}
    </div>
  );
}

/** Emojis: on or off, how big and where, and every one in the reel on its word, each changeable to any emoji. */
export function EmojiPanel({ edit, lines, time, on, behind, actions }: { edit: ReelEdit; lines: CaptionLine[]; time: number; on: boolean; behind: boolean; actions: EmojiActions }) {
  const [open, setOpen] = useState<number | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  // The word being said at the playhead (or the next one), for "Add".
  const here = lines.flatMap((l) => l.words).find((w, k, all) => w.start <= time && (all[k + 1]?.start ?? Infinity) > time) ?? lines.flatMap((l) => l.words).find((w) => w.start >= time);
  const emojis = [...edit.emojis].sort((a, b) => edit.words[a.word].start - edit.words[b.word].start);
  return (
    <div className="space-y-4">
      <label className={cn("flex items-start gap-3 rounded-lg border border-gray-alpha-400 p-3 text-sm", behind ? "opacity-60" : "cursor-pointer")}>
        <input type="checkbox" disabled={behind} checked={on && !behind} onChange={(e) => actions.setOn(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
        <span>
          <span className="block font-medium text-gray-1000">Emojis</span>
          <span className="mt-0.5 block text-xs text-gray-900">{behind ? "Off with Behind you: the big words do the emphasis." : "Any emoji, on any word: it pops in as the word is said."}</span>
        </span>
      </label>
      {on && !behind && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[13px] text-gray-900">Size</p>
              <Choice label="Emoji size" options={SIZES} value={edit.emojiStyle.size} onChange={(size) => actions.setStyle({ size })} />
            </div>
            <div>
              <p className="mb-1.5 text-[13px] text-gray-900">Place</p>
              <Choice label="Emoji place" options={PLACES} value={edit.emojiStyle.place} onChange={(place) => actions.setStyle({ place })} />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-1000">In this reel</p>
              {here && (
                <button
                  type="button"
                  onClick={(e) => {
                    anchor.current = e.currentTarget;
                    setOpen(here.i);
                  }}
                  className="flex h-8 max-w-[60%] items-center gap-1.5 rounded-md bg-gray-1000 px-3 text-[13px] font-medium text-background-100"
                >
                  <Plus className="size-3.5 shrink-0" />
                  <span className="truncate">Add on “{edit.words[here.i].text}”</span>
                </button>
              )}
            </div>
            {emojis.length === 0 && <p className="text-[13px] text-gray-900">None yet. Add one on the word at the playhead, or click a word on the video.</p>}
            <ul className="space-y-1.5">
              {emojis.map((e) => (
                <li key={e.word} className="flex items-center gap-2 rounded-lg border border-gray-alpha-400 px-2.5 py-1.5">
                  <button type="button" onClick={() => actions.seek(Math.max(0, edit.words[e.word].start - 0.5))} className="w-14 shrink-0 text-left text-xs tabular-nums text-gray-900 hover:text-gray-1000">
                    {clock(edit.words[e.word].start)}
                  </button>
                  <button
                    type="button"
                    onClick={(ev) => {
                      anchor.current = ev.currentTarget;
                      setOpen(e.word);
                    }}
                    className="flex size-8 items-center justify-center rounded-md border border-gray-alpha-400 text-lg hover:bg-gray-alpha-100"
                    aria-label={`Change the emoji on “${edit.words[e.word].text}”`}
                  >
                    {e.emoji}
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-gray-1000">on “{edit.words[e.word].text}”</span>
                  <button type="button" onClick={() => actions.set(e.word, null)} aria-label={`Remove the emoji on “${edit.words[e.word].text}”`} className="flex size-8 items-center justify-center rounded-md text-gray-900 hover:bg-gray-alpha-100 hover:text-red-900">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <Popover anchor={anchor} open={open !== null} onClose={() => setOpen(null)} label="Pick an emoji" width={340}>
        <EmojiPicker
          value={open === null ? null : (edit.emojis.find((e) => e.word === open)?.emoji ?? null)}
          onPick={(emoji) => {
            if (open !== null) actions.set(open, emoji);
            setOpen(null);
          }}
        />
      </Popover>
    </div>
  );
}
