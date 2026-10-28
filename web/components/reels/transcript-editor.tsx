"use client";
import { CornerDownLeft, EyeOff, Scissors, Smile, Sparkles, Star, Volume2, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cueOf, type CaptionLine, type ReelStyle } from "@launchreel/core/captions";
import { EFFECTS, REEL_EFFECTS, type ReelEffect } from "@launchreel/core/effects";
import { ZOOM_STRENGTHS, type ReelEdit, type ZoomStrength } from "@launchreel/core/reel";
import { REEL_SOUNDS, type ReelSound } from "@launchreel/core/sounds";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { EmojiPicker } from "./emoji-picker";
import { SoundPicker } from "./sound-picker";

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const FILLER = /^(u+m+|u+h+|e+r+m+|h+m+|a+h+|e+h+)[,.!?…]*$/i;
const ZOOM_LABEL: Record<ZoomStrength, string> = { subtle: "Subtle", medium: "Medium", strong: "Strong" };

export type WordActions = {
  /** Selects a word (and the player jumps to it). */
  select: (word: number) => void;
  setText: (word: number, text: string) => void;
  /** Highlights the word, or takes it back. "Behind you": a line's first highlight is its big word. */
  toggleKeyword: (word: number) => void;
  toggleHidden: (word: number) => void;
  hideWords: (words: number[]) => void;
  /** Starts a new caption line at the word, or joins it back. */
  toggleBreak: (word: number) => void;
  setEmoji: (word: number, emoji: string | null) => void;
  setZoom: (word: number, strength: ZoomStrength | null) => void;
  /** A sound as the word is said (null takes the word's sound away). */
  setSound: (word: number, sound: ReelSound | null) => void;
  /** Adds an effect as the word is said. */
  addEffect: (word: number, effect: ReelEffect) => void;
  /** Cuts words out of the video (picture and sound), and puts a cut word back (with the rest of its cut). */
  cutWords: (words: number[]) => void;
  restoreWord: (word: number) => void;
};

/** Every word in order, grouped by the caption line it's on; hidden words sit with the line before them. */
export function transcriptRows(edit: ReelEdit, lines: CaptionLine[]): { line: number; words: number[] }[] {
  const lineOf = new Map(lines.flatMap((l, li) => l.words.map((w) => [w.i, li] as const)));
  const rows = lines.map((_, li) => ({ line: li, words: [] as number[] }));
  let current = 0;
  edit.words.forEach((_, i) => {
    const li = lineOf.get(i);
    if (li !== undefined) current = li;
    rows[current]?.words.push(i);
  });
  return rows.filter((r) => r.words.length);
}

/** The sound on a word: one landing as it's said (within 0.15 s). */
export const soundOfWord = (edit: ReelEdit, word: number) => edit.sounds.findIndex((s) => Math.abs(s.at - cueOf(edit.words, word)) < 0.15);

/**
 * The reel's words as the captions show them, a line a row: click a word to jump there and change it, or anything on it.
 */
export function TranscriptEditor({ edit, lines, time, style, selected, hookOn, onHookText, onHookOn, emojisOn, zoomsOn, sfxOn, cut, actions }: { edit: ReelEdit; lines: CaptionLine[]; time: number; style: ReelStyle; selected: number | null; hookOn: boolean; onHookText: (text: string) => void; onHookOn: (on: boolean) => void; emojisOn: boolean; zoomsOn: boolean; sfxOn: boolean; cut: Set<number>; actions: WordActions }) {
  const rows = transcriptRows(edit, lines);
  const playing = lines.findIndex((l) => time >= l.start && time < l.end);
  const keys = new Set(edit.keywords);
  const hidden = new Set(edit.hidden);
  const breaks = new Set(edit.breaks);
  const fillers = edit.words.map((w, i) => i).filter((i) => FILLER.test(edit.words[i].text) && !cut.has(i));
  const keyName = style === "behind" ? "big word" : "highlight";
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-alpha-400 p-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-1000">
          <input type="checkbox" checked={hookOn} onChange={(e) => onHookOn(e.target.checked)} className="size-4 accent-[var(--ds-gray-1000)]" />
          Hook title
        </label>
        <p className="mt-0.5 pl-7 text-xs text-gray-900">A big title for the first 2.5 seconds: the reel&apos;s promise in a few words.</p>
        {hookOn && <input value={edit.hook} maxLength={48} placeholder="3 habits that doubled my sales" onChange={(e) => onHookText(e.target.value)} aria-label="Hook title" className="mt-2 h-9 w-full rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-sm text-gray-1000 outline-none focus:border-gray-1000 sm:ml-7 sm:w-[calc(100%-1.75rem)]" />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-gray-900">Click a word to fix it, cut it, hide it, start a line, or give it a {keyName}, emoji, zoom, sound or effect.</p>
        {fillers.length > 0 && (
          <button type="button" onClick={() => actions.cutWords(fillers)} className="flex h-8 items-center gap-1.5 rounded-md border border-gray-alpha-400 px-2.5 text-[13px] text-gray-1000 hover:bg-gray-alpha-100">
            <Scissors className="size-3.5" />
            Cut {fillers.length} filler {fillers.length === 1 ? "word" : "words"} (um, uh)
          </button>
        )}
      </div>

      <div className="space-y-1">
        {rows.map(({ line, words }) => {
          const open = selected !== null && words.includes(selected);
          const lineEmojis = edit.emojis.filter((e) => words.includes(e.word));
          const zoom = edit.zooms.some((z) => words.includes(z.word));
          return (
            <div key={line} className={cn("rounded-md px-2 py-1.5 transition-colors", line === playing && "bg-gray-alpha-100", open && "bg-gray-alpha-100 ring-1 ring-gray-alpha-400")}>
              <div className="flex items-baseline gap-2">
                <button type="button" onClick={() => actions.select(words.find((w) => !hidden.has(w)) ?? words[0])} className="w-9 shrink-0 text-left text-xs tabular-nums text-gray-900 hover:text-gray-1000">
                  {clock(edit.words[words[0]].start)}
                </button>
                <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[15px] leading-7">
                  {words.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => actions.select(w)}
                      title={cut.has(w) ? "Cut from the video" : hidden.has(w) ? "Hidden from the captions" : keys.has(w) ? `The ${keyName}` : undefined}
                      className={cn(
                        "rounded px-1 transition-colors",
                        cut.has(w) ? "text-red-900 line-through decoration-red-900/70 opacity-70" : hidden.has(w) ? "text-gray-900 line-through decoration-gray-900/60" : keys.has(w) ? "bg-brand/20 font-semibold text-gray-1000" : "text-gray-1000 hover:bg-gray-alpha-200",
                        breaks.has(w) && "ml-2 border-l-2 border-gray-alpha-500 pl-1.5",
                        w === selected && "ring-2 ring-gray-1000",
                      )}
                    >
                      {edit.words[w].text}
                    </button>
                  ))}
                  {emojisOn && lineEmojis.map((e) => <span key={e.word} className="text-base">{e.emoji}</span>)}
                  {zoom && zoomsOn && <ZoomIn className="size-3.5 text-gray-900" aria-label="Punch-in" />}
                </div>
              </div>
              {open && selected !== null && <WordPanel key={selected} word={selected} edit={edit} keyName={keyName} emojisOn={emojisOn && style !== "behind"} zoomsOn={zoomsOn} sfxOn={sfxOn} cut={cut.has(selected)} actions={actions} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The selected word's controls. */
export function WordPanel({ word, edit, keyName, emojisOn, zoomsOn, sfxOn, cut = false, actions, dark = false, focusText = false }: { word: number; edit: ReelEdit; keyName: string; emojisOn: boolean; zoomsOn: boolean; sfxOn: boolean; cut?: boolean; actions: WordActions; dark?: boolean; focusText?: boolean }) {
  const [text, setText] = useState(edit.words[word].text);
  useEffect(() => setText(edit.words[word].text), [edit.words, word]);
  const [open, setOpen] = useState<"emoji" | "sound" | "effect" | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const save = () => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean && clean !== edit.words[word].text) actions.setText(word, clean);
    else setText(edit.words[word].text);
  };
  const isKey = edit.keywords.includes(word);
  const isHidden = edit.hidden.includes(word);
  const isBreak = edit.breaks.includes(word);
  const zoom = edit.zooms.find((z) => z.word === word)?.strength ?? null;
  const emoji = edit.emojis.find((e) => e.word === word)?.emoji ?? null;
  const soundIndex = soundOfWord(edit, word);
  const sound = soundIndex >= 0 ? edit.sounds[soundIndex].sound : null;
  const chip = (on: boolean) =>
    cn(
      "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors",
      dark ? (on ? "border-white bg-white text-black" : "border-white/25 text-white hover:bg-white/10") : on ? "border-gray-1000 bg-gray-alpha-200 text-gray-1000" : "border-gray-alpha-400 text-gray-1000 hover:bg-gray-alpha-100",
    );
  const openFrom = (which: "emoji" | "sound" | "effect", el: HTMLElement) => {
    anchor.current = el;
    setOpen(which);
  };
  return (
    <div className={cn("space-y-2.5", !dark && "mt-2 border-t border-gray-alpha-400 pt-3 sm:ml-11")}>
      {!dark && (
        <label className="block">
          <span className="mb-1 block text-xs text-gray-900">Word</span>
          <input
            value={text}
            maxLength={40}
            autoFocus={focusText}
            onChange={(e) => setText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setText(edit.words[word].text);
            }}
            className="h-9 w-full rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-sm text-gray-1000 outline-none focus:border-gray-1000 sm:max-w-xs"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={cut} onClick={() => (cut ? actions.restoreWord(word) : actions.cutWords([word]))} className={chip(cut)} title={cut ? "Put this back in the video" : "Cut this word out of the video: picture and sound"}>
          <Scissors className="size-3.5" />
          {cut ? "Cut · put back" : "Cut"}
        </button>
        <button type="button" aria-pressed={isKey} onClick={() => actions.toggleKeyword(word)} className={chip(isKey)}>
          <Star className="size-3.5" />
          {keyName === "big word" ? "Big word" : "Highlight"}
        </button>
        <button type="button" aria-pressed={isHidden} onClick={() => actions.toggleHidden(word)} className={chip(isHidden)} title="Leave it out of the captions (it's still heard)">
          <EyeOff className="size-3.5" />
          {isHidden ? "Hidden" : "Hide"}
        </button>
        <button type="button" aria-pressed={isBreak} onClick={() => actions.toggleBreak(word)} className={chip(isBreak)} title="Start a new caption line at this word">
          <CornerDownLeft className="size-3.5" />
          New line
        </button>
        {emojisOn && (
          <button type="button" aria-pressed={Boolean(emoji)} onClick={(e) => openFrom("emoji", e.currentTarget)} className={chip(Boolean(emoji))}>
            {emoji ? <span className="text-base leading-none">{emoji}</span> : <Smile className="size-3.5" />}
            Emoji
          </button>
        )}
        {sfxOn && (
          <button type="button" aria-pressed={Boolean(sound)} onClick={(e) => openFrom("sound", e.currentTarget)} className={chip(Boolean(sound))}>
            <Volume2 className="size-3.5" />
            {sound ? REEL_SOUNDS[sound].label : "Sound"}
          </button>
        )}
        <button type="button" onClick={(e) => openFrom("effect", e.currentTarget)} className={chip(false)}>
          <Sparkles className="size-3.5" />
          Effect
        </button>
      </div>
      {zoomsOn && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("flex items-center gap-1 text-xs", dark ? "text-white/70" : "text-gray-900")}>
            <ZoomIn className="size-3.5" />
            Zoom
          </span>
          {[null, ...ZOOM_STRENGTHS].map((s) => (
            <button key={s ?? "off"} type="button" aria-pressed={zoom === s} onClick={() => actions.setZoom(word, s)} className={cn(chip(zoom === s), "h-7 px-2 text-xs")}>
              {s ? ZOOM_LABEL[s] : "Off"}
            </button>
          ))}
        </div>
      )}
      <Popover anchor={anchor} open={open !== null} onClose={() => setOpen(null)} label={open === "emoji" ? "Pick an emoji" : open === "sound" ? "Pick a sound" : "Add an effect"} width={open === "emoji" ? 340 : 300}>
        {open === "emoji" && (
          <div>
            <EmojiPicker
              value={emoji}
              onPick={(e) => {
                actions.setEmoji(word, e);
                setOpen(null);
              }}
            />
            {emoji && (
              <button type="button" onClick={() => (actions.setEmoji(word, null), setOpen(null))} className="mt-1 h-8 w-full rounded-md border border-gray-alpha-400 bg-background-100 text-[13px] text-gray-1000 hover:bg-gray-alpha-100">
                Remove the emoji
              </button>
            )}
          </div>
        )}
        {open === "sound" && (
          <SoundPicker
            value={sound}
            onPick={(s) => {
              actions.setSound(word, s);
              setOpen(null);
            }}
          />
        )}
        {open === "effect" && (
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-gray-alpha-400 bg-background-100 p-2 shadow-lg">
            {REEL_EFFECTS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  actions.addEffect(word, e);
                  setOpen(null);
                }}
                title={EFFECTS[e].hint}
                className="h-9 rounded-md border border-gray-alpha-400 px-2 text-[13px] text-gray-1000 hover:bg-gray-alpha-100"
              >
                {EFFECTS[e].label}
              </button>
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}
