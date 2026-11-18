import { bedLabel } from "@launchreel/core/music-beds";
import type { ReelEdit } from "@launchreel/core/reel";
import type { EditorOptions } from "./reel-editor";

type Draft = { options: EditorOptions; edit: ReelEdit };

const OPTION_LABEL: Record<keyof EditorOptions, string> = { style: "Caption style", captions: "Captions", look: "Caption look", fonts: "Big-word fonts", emojis: "Emojis", zooms: "Punch-ins", sfx: "Sound effects", hook: "Hook title" };
// What an answer can change in the edit (the reel's size, length and shot changes it can't).
const EDIT_LABEL: Partial<Record<keyof ReelEdit, string>> = {
  words: "Caption words",
  hidden: "Hidden words",
  breaks: "Line breaks",
  keywords: "Highlights",
  emojis: "Emojis",
  emojiStyle: "Emoji style",
  zooms: "Punch-ins",
  sounds: "Sound effects",
  hookSound: "Hook sound",
  effects: "Effects",
  picture: "Look",
  hook: "Hook title",
  trims: "Cuts",
  audio: "Audio",
  broll: "B-roll",
};
const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The parts of the draft an answer changed: options and edit fields, by name. */
function touched(before: Draft, after: Draft) {
  return {
    options: (Object.keys(OPTION_LABEL) as (keyof EditorOptions)[]).filter((k) => differs(before.options[k], after.options[k])),
    edit: (Object.keys(EDIT_LABEL) as (keyof ReelEdit)[]).filter((k) => differs(before.edit[k], after.edit[k])),
  };
}

/** What an Ask AI answer changed, a short line each, for its message ("Cuts: 2 → 5", "Music: Calm"). */
export function describeChanges(before: Draft, after: Draft): string[] {
  const { options, edit } = touched(before, after);
  const out: string[] = [];
  for (const k of options) {
    const now = after.options[k];
    if (typeof now === "boolean") out.push(`${OPTION_LABEL[k]} ${now ? "on" : "off"}`);
    else if (k === "style") out.push(`${OPTION_LABEL[k]}: ${capital(after.options.style)}`);
    else out.push(OPTION_LABEL[k]);
  }
  for (const k of edit) {
    const label = EDIT_LABEL[k]!;
    const [was, now] = [before.edit[k], after.edit[k]];
    if (k === "words") {
      const n = after.edit.words.filter((w, i) => w.text !== before.edit.words[i]?.text).length;
      out.push(`${label}: ${n} reworded`);
    } else if (k === "audio") {
      const [m0, m1] = [before.edit.audio.music, after.edit.audio.music];
      if (differs(m0?.track, m1?.track)) out.push(m1 ? `Music: ${bedLabel(m1.track)}` : "Music off");
      else if (m1 && m0 && m0.volume !== m1.volume) out.push(`Music volume: ${Math.round(m1.volume * 100)}%`);
      if (before.edit.audio.clean !== after.edit.audio.clean) out.push(`Clean audio ${after.edit.audio.clean ? "on" : "off"}`);
    } else if (Array.isArray(was) && Array.isArray(now) && was.length !== now.length) out.push(`${label}: ${was.length} → ${now.length}`);
    else out.push(label);
  }
  return out;
}

const isRecord = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

/**
 * `now` with one change (`was` → `then`) taken back, as finely as it was made: in an object only the fields it changed
 * (the caption look holds colour, casing, size and more, and undoing the colour must leave the casing), in a list only
 * the items it added or removed, and a value only while it's still what the change made it (a later change wins).
 */
function takeBack(now: unknown, was: unknown, then: unknown): unknown {
  if (!differs(was, then)) return now;
  if (isRecord(now) && isRecord(was) && isRecord(then)) {
    const out: Record<string, unknown> = { ...now };
    for (const k of new Set([...Object.keys(was), ...Object.keys(then)])) {
      const v = takeBack(now[k], was[k], then[k]);
      if (v === undefined) delete out[k];
      else out[k] = v;
    }
    return out;
  }
  if (Array.isArray(now) && Array.isArray(was) && Array.isArray(then)) {
    // The same items in the same places (the words): each one on its own.
    if (now.length === was.length && was.length === then.length) return now.map((v, i) => takeBack(v, was[i], then[i]));
    const id = (v: unknown) => JSON.stringify(v);
    const before = new Set(was.map(id));
    const after = new Set(then.map(id));
    const out = now.filter((v) => before.has(id(v)) || !after.has(id(v)));
    was.forEach((v, i) => {
      if (!after.has(id(v)) && !out.some((o) => id(o) === id(v))) out.splice(Math.min(i, out.length), 0, v);
    });
    return out;
  }
  return differs(now, then) ? now : was;
}

/**
 * The draft with one answer taken back: what it changed put back as it was before it, field by field; the rest
 * (changes made since, by other answers or by hand) kept. Null when there's nothing left to take back.
 */
export function revertChanges(draft: Draft, before: Draft, after: Draft): Draft | null {
  const { options, edit } = touched(before, after);
  const next = { options: { ...draft.options }, edit: { ...draft.edit } } as Draft;
  for (const k of options) (next.options as Record<string, unknown>)[k] = takeBack(draft.options[k], before.options[k], after.options[k]);
  for (const k of edit) (next.edit as Record<string, unknown>)[k] = takeBack(draft.edit[k], before.edit[k], after.edit[k]);
  return differs(next, draft) ? next : null;
}
