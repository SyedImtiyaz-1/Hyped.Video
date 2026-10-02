// What happens when in a reel, worked out from its edit: the punch-ins, when each emoji shows, which sound starts when,
// and which part of the picture is in view. The render (runner/src/reel.ts) and the editor's preview both use these, so
// the video does what the editor showed.

import { cueOf, lineAtTime, lineOfWord, type CaptionLine } from "./captions";
import { ZOOM_AMOUNT, type ReelEdit } from "./reel";
import { REEL_SOUNDS, type ReelSound } from "./sounds";
import { round } from "./words";

/** The hook title is up from HOOK_START to HOOK_END seconds; its sound lands at HOOK_SOUND. */
export const HOOK_START = 0.1;
export const HOOK_END = 2.6;
export const HOOK_SOUND = 0.12;

/* ---------- punch-ins ---------- */

/** A punch-in: eases in over 0.3 s from `start`, holds, and eases out over 0.45 s from `end`; `word` is the word it's on. */
export type ZoomWindow = { start: number; end: number; amount: number; word?: number };

/** The punch-ins: each from just before its word, held to the end of its line (0.8 to 2.5 s). */
export function zoomWindows(edit: Pick<ReelEdit, "words" | "zooms" | "duration">, lines: readonly CaptionLine[]): ZoomWindow[] {
  return edit.zooms
    .map(({ word, strength }) => {
      const cue = cueOf(edit.words, word);
      const start = round(Math.max(0, cue - 0.08));
      const li = lineOfWord(lines, word);
      const lineEnd = li >= 0 ? lines[li].end : cue + 1;
      const end = round(Math.min(edit.duration - 0.5, start + Math.min(2.5, Math.max(0.8, lineEnd - start))));
      return { start, end, amount: ZOOM_AMOUNT[strength], word };
    })
    .filter((z) => z.end > z.start)
    .sort((a, b) => a.start - b.start);
}

/** How much closer the punch-ins are at `t` (0.12 is 12% closer). */
export function punchAt(windows: readonly ZoomWindow[], t: number): number {
  let zoom = 0;
  for (const z of windows) {
    const rise = 1 - (1 - Math.min(1, Math.max(0, (t - z.start) / 0.3))) ** 3;
    const fall = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, (t - z.end) / 0.45)));
    zoom += z.amount * rise * (1 - fall);
  }
  return zoom;
}

/** punchAt as an ffmpeg expression of `t`. */
export function punchExpr(windows: readonly ZoomWindow[], t: string): string {
  if (!windows.length) return "0";
  return windows
    .map((z) => `${z.amount}*(1-pow(1-clip((${t}-${z.start})/0.3,0,1),3))*(1-(0.5-0.5*cos(PI*clip((${t}-${z.end})/0.45,0,1))))`)
    .join("+");
}

/* ---------- the view ---------- */

/** Where zooms aim: a little above the middle of tall videos (where faces are), a little lower on wide ones. */
export const zoomAim = (width: number, height: number) => (height / width >= 1.15 ? 0.4 : 0.45);

/**
 * The part of the picture in view, zoomed by `zoom` around `aimY` and moved by (dx, dy), as shares of the frame, kept
 * inside the picture: its top-left corner and its size (1 / zoom).
 */
export function viewport(zoom: number, dx: number, dy: number, aimY: number): { x: number; y: number; size: number } {
  const size = 1 / Math.max(1, zoom);
  return {
    x: Math.min(1 - size, Math.max(0, (1 - size) / 2 - dx * size)),
    y: Math.min(1 - size, Math.max(0, aimY - size / 2 - dy * size)),
    size,
  };
}

/* ---------- emojis ---------- */

/** An emoji on screen: from its word's caption until the next emoji, or a little after its line (1.1 s at least). */
export type EmojiShow = { word: number; emoji: string; start: number; end: number; line: number };

export function emojiShows(edit: Pick<ReelEdit, "words" | "emojis" | "duration">, lines: readonly CaptionLine[]): EmojiShow[] {
  const timed = edit.emojis.map((e) => ({ ...e, start: cueOf(edit.words, e.word) })).sort((a, b) => a.start - b.start || a.word - b.word);
  return timed
    .map((e, k) => {
      const own = lineOfWord(lines, e.word);
      const line = own >= 0 ? own : lineAtTime(lines, e.start);
      const lineEnd = line >= 0 ? lines[line].end : e.start;
      const end = round(Math.min(edit.duration, timed[k + 1]?.start ?? Infinity, Math.max(e.start + 1.1, lineEnd)));
      return { word: e.word, emoji: e.emoji, start: e.start, end, line };
    })
    .filter((e) => e.end - e.start >= 0.15);
}

/* ---------- sound ---------- */

/** A sound to mix: which file (repeats take turns), its gain, when it starts, and how much of its start is cut off. */
export type SoundCue = { sound: ReelSound; variant: number; file: string; gainDb: number; start: number; skip: number };

/** The sounds, each starting early enough to land on its moment; the hook's when its title shows. */
export function soundCues(edit: Pick<ReelEdit, "sounds" | "hookSound" | "hook">, hookOn: boolean): SoundCue[] {
  const all = [...edit.sounds, ...(hookOn && edit.hook && edit.hookSound ? [{ at: HOOK_SOUND, sound: edit.hookSound }] : [])].sort((a, b) => a.at - b.at);
  const used: Partial<Record<ReelSound, number>> = {};
  return all.map(({ at, sound }) => {
    const info = REEL_SOUNDS[sound];
    const variant = (used[sound] = (used[sound] ?? -1) + 1) % info.files.length;
    const start = at - info.peak;
    return { sound, variant, file: info.files[variant], gainDb: info.gainDb, start: round(Math.max(0, start)), skip: round(Math.max(0, -start)) };
  });
}
