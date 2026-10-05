// Cutting the dead air out of a reel: long pauses, filler sounds, retakes, and whatever the customer cuts themselves. A
// reel's edit keeps everything on the upload's own clock (words, marks, sounds, effects), plus the stretches cut out of
// it ("trims"), so any cut can be put back. The render and the editor's preview both see the edit through
// onCutTimeline(), which moves every time onto the shorter clock of the cut video: they show the same thing.
//
// Trims start and end on whole frames (REEL_FPS), so the picture and the sound are cut at exactly the same moments
// (48 kHz audio has 1,600 samples a frame) and stay in sync however many cuts there are.
import { BROLL_LENGTH, type BrollShot } from "./broll";
import type { ReelEdit } from "./reel";

export const REEL_FPS = 30;

/** Why a stretch was cut: found by the AI (a long pause, a filler sound, an earlier take), or cut by the customer. */
export type TrimReason = "pause" | "filler" | "retake" | "cut";
export const TRIM_REASONS: readonly TrimReason[] = ["pause", "filler", "retake", "cut"];
export type Trim = { start: number; end: number; reason: TrimReason };

/** How much the AI cuts on the first render: nothing, long pauses, or pauses plus filler sounds and retakes. */
export type ReelCleanup = "off" | "pauses" | "full";
export const REEL_CLEANUPS: readonly ReelCleanup[] = ["off", "pauses", "full"];

const MAX_TRIMS = 2000;
/** A reel keeps at least this much: trims that would leave less are dropped. */
const MIN_KEPT = 1;
const round = (t: number) => Math.round(t * 1000) / 1000;
/** To the nearest frame boundary. */
export const toFrame = (t: number) => Math.round(t * REEL_FPS) / REEL_FPS;

/**
 * Trims read back defensively: inside the video, on whole frames, at least a frame long, in order, with overlapping or
 * touching trims merged (the earlier one's reason stays). None when they'd leave less than a second of video.
 */
export function parseTrims(value: unknown, duration: number): Trim[] {
  if (!Array.isArray(value) || !(duration > 0)) return [];
  const raw = value
    .map((x) => {
      const t = (x ?? {}) as Partial<Trim>;
      const start = Math.max(0, toFrame(Number(t.start)));
      const end = Math.min(duration, toFrame(Number(t.end)));
      const reason = TRIM_REASONS.includes(t.reason as TrimReason) ? (t.reason as TrimReason) : "cut";
      return Number.isFinite(start) && Number.isFinite(end) && end - start >= 1 / REEL_FPS - 1e-6 ? { start: round(start), end: round(end), reason } : null;
    })
    .filter((t): t is Trim => t !== null)
    .sort((a, b) => a.start - b.start);
  const merged: Trim[] = [];
  for (const t of raw) {
    const last = merged[merged.length - 1];
    if (last && t.start <= last.end + 1e-6) last.end = Math.max(last.end, t.end);
    else merged.push({ ...t });
  }
  const trims = merged.slice(0, MAX_TRIMS);
  const removed = trims.reduce((s, t) => s + (t.end - t.start), 0);
  return duration - removed >= MIN_KEPT ? trims : [];
}

/** The stretches of the upload that stay, in order: [start, end] seconds, between the trims. */
export function keptSegments(duration: number, trims: readonly Trim[]): [number, number][] {
  const out: [number, number][] = [];
  let at = 0;
  for (const t of trims) {
    if (t.start - at >= 1 / REEL_FPS - 1e-6) out.push([round(at), round(t.start)]);
    at = Math.max(at, t.end);
  }
  if (duration - at > 1e-6) out.push([round(at), round(duration)]);
  return out;
}

/** The two clocks of a trimmed reel: the upload's and the cut video's. */
export type CutClock = {
  /** The kept stretches, in upload seconds. */
  segments: [number, number][];
  /** The cut video's length. */
  duration: number;
  /** An upload moment on the cut video's clock; a moment inside a trim lands on the cut. */
  toCut(t: number): number;
  /** A cut-video moment on the upload's clock. */
  toUpload(t: number): number;
  /** Whether an upload moment is kept (not inside a trim). */
  isKept(t: number): boolean;
  /** Where the cuts fall on the cut video's clock (one per joint between kept stretches). */
  joints: number[];
};

export function cutClock(duration: number, trims: readonly Trim[]): CutClock {
  const segments = keptSegments(duration, trims);
  const offsets: number[] = [];
  let total = 0;
  for (const [a, b] of segments) {
    offsets.push(total);
    total += b - a;
  }
  // The last segment that starts at or before t (binary search: reels can have hundreds of cuts).
  const segmentAt = (t: number) => {
    let lo = 0;
    let hi = segments.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid][0] <= t) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found;
  };
  const toCut = (t: number) => {
    if (!segments.length) return 0;
    const k = segmentAt(t);
    if (k < 0) return 0;
    const [a, b] = segments[k];
    // Past this segment's end (inside the trim after it): the cut, where the next segment starts.
    return round(t <= b ? offsets[k] + (t - a) : k + 1 < segments.length ? offsets[k + 1] : total);
  };
  const toUpload = (t: number) => {
    if (!segments.length) return 0;
    let lo = 0;
    let hi = segments.length - 1;
    let k = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid] <= t) {
        k = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const [a, b] = segments[k];
    return round(Math.min(b, a + Math.max(0, t - offsets[k])));
  };
  const isKept = (t: number) => {
    const k = segmentAt(t);
    return k >= 0 && t < segments[k][1];
  };
  return { segments, duration: round(total), toCut, toUpload, isKept, joints: offsets.slice(1).map(round) };
}

/** The trim a moment falls in (an index into `trims`), or -1. */
export function trimAt(trims: readonly Trim[], t: number): number {
  return trims.findIndex((x) => t >= x.start && t < x.end);
}

/** The words that are cut: a word is cut when its middle falls inside a trim. */
export function trimmedWords(words: readonly { start: number; end: number }[], trims: readonly Trim[]): number[] {
  if (!trims.length) return [];
  const out: number[] = [];
  words.forEach((w, i) => {
    if (trimAt(trims, (w.start + w.end) / 2) >= 0) out.push(i);
  });
  return out;
}

/**
 * The edit on the cut video's clock, as the render makes it and the editor previews it: every time moved onto the cut
 * clock, cut words hidden (with their highlights, emojis and punch-ins), and sounds and effects inside a trim dropped.
 * B-roll that starts in a trim starts at the cut instead, kept inside the video and clear of the shot before it. Word
 * numbers stay as they are, so a word picked on the preview is the same word in the edit.
 */
export function onCutTimeline(edit: ReelEdit): ReelEdit {
  if (!edit.trims.length) return edit;
  const clock = cutClock(edit.duration, edit.trims);
  const cut = new Set(trimmedWords(edit.words, edit.trims));
  return {
    ...edit,
    duration: clock.duration,
    words: edit.words.map((w) => ({ text: w.text, start: clock.toCut(w.start), end: clock.toCut(w.end) })),
    hidden: [...new Set([...edit.hidden, ...cut])].sort((a, b) => a - b),
    keywords: edit.keywords.filter((i) => !cut.has(i)),
    emojis: edit.emojis.filter((e) => !cut.has(e.word)),
    zooms: edit.zooms.filter((z) => !cut.has(z.word)),
    sounds: edit.sounds.filter((s) => clock.isKept(s.at)).map((s) => ({ ...s, at: clock.toCut(s.at) })),
    effects: edit.effects.filter((e) => clock.isKept(e.at)).map((e) => ({ ...e, at: clock.toCut(e.at) })),
    cuts: [...new Set([...edit.cuts.filter((c) => clock.isKept(c)).map(clock.toCut), ...clock.joints])].sort((a, b) => a - b),
    broll: edit.broll.reduce<BrollShot[]>((out, s) => {
      const at = clock.toCut(s.at);
      const last = out[out.length - 1];
      const length = Math.min(s.length, clock.duration - at);
      if ((!last || at >= last.at + last.length) && length >= BROLL_LENGTH.min) out.push({ ...s, at, length });
      return out;
    }, []),
    trims: [],
  };
}

// A pause longer than PAUSE_MAX is shortened to a natural beat: a little air after the last word and before the next
// (a voice starts a moment before its first word is recognized). The video starts just before the first word and ends
// a moment after the last.
const PAUSE_MAX = 0.6;
const PAUSE_AFTER = 0.12;
const PAUSE_BEFORE = 0.18;
const LEAD_IN = 0.25;
const TAIL = 0.6;

/** Trims for the long pauses between words (and before the first and after the last), from the word timings alone. */
export function pauseTrims(words: readonly { start: number; end: number }[], duration: number): Trim[] {
  if (!words.length) return [];
  const out: Trim[] = [];
  const [first, last] = [words[0], words[words.length - 1]];
  if (first.start - LEAD_IN >= 0.2) out.push({ start: 0, end: first.start - LEAD_IN, reason: "pause" });
  for (let i = 1; i < words.length; i++) {
    if (words[i].start - words[i - 1].end > PAUSE_MAX) out.push({ start: words[i - 1].end + PAUSE_AFTER, end: words[i].start - PAUSE_BEFORE, reason: "pause" });
  }
  if (duration - (last.end + TAIL) >= 0.3) out.push({ start: last.end + TAIL, end: duration, reason: "pause" });
  return out;
}

/** A trim that cuts words `from`..`to` (inclusive) out, with a little room either side, clear of the words around them. */
export function wordsTrim(words: readonly { start: number; end: number }[], from: number, to: number, reason: TrimReason = "cut"): Trim {
  const before = words[from - 1]?.end ?? 0;
  const after = words[to + 1]?.start ?? Infinity;
  return { start: round(Math.max(before + 0.03, words[from].start - 0.04)), end: round(Math.min(after - 0.05, words[to].end + 0.05)), reason };
}

/** How much the trims take out, by reason: seconds and count. */
export function trimTotals(trims: readonly Trim[]): Record<TrimReason, { count: number; seconds: number }> {
  const out = Object.fromEntries(TRIM_REASONS.map((r) => [r, { count: 0, seconds: 0 }])) as Record<TrimReason, { count: number; seconds: number }>;
  for (const t of trims) {
    out[t.reason].count++;
    out[t.reason].seconds = round(out[t.reason].seconds + (t.end - t.start));
  }
  return out;
}
