// Reel help: a customer uploads a short video they recorded (a talking-head reel, a Short, a product demo) and gets it
// back with word-by-word captions, keyword emphasis, emojis, punch-in zooms, sound effects and an optional hook title.
// Shared by the web app (options, prices, upload limits), the render Worker and the runner (runner/src/reel.ts).
// No Prisma here: the browser and the container import it.
import { parseLookChanges, REEL_STYLES, type ReelLookChanges, type ReelStyle } from "./captions";
import { EFFECTS, isReelEffect, type PlacedEffect } from "./effects";
import { customerError } from "./engines";
import { parsePicture, type ReelPicture } from "./picture";
import { isReelSound, type ReelSound } from "./sounds";

// The caption styles and what customers can change about them live in captions.ts.
export { REEL_STYLES, type ReelStyle } from "./captions";

/**
 * What the captions are written in. "auto" follows the speech; "hinglish" (beta) writes Hindi and English speech in
 * Roman script, the way creators type it. Other languages are refused for now: the caption fonts cover Latin script.
 */
export type ReelLanguage = "auto" | "en" | "hinglish";
export const REEL_LANGUAGES: readonly ReelLanguage[] = ["auto", "en", "hinglish"];

/**
 * Font styles for "behind"'s big words (its small captions stay Inter, so they always read): white Inter, yellow Anton,
 * red Abril Fatface, white DM Serif italic, blue Kaushan Script, white Permanent Marker, hollow Inter, lime Archivo Black.
 * A reel takes one, or mixes up to REEL_MAX_FONTS: the big words take turns, in the order they were picked.
 */
export type ReelFont = "classic" | "impact" | "editorial" | "elegant" | "script" | "marker" | "outline" | "pop";
export const REEL_FONTS: readonly ReelFont[] = ["classic", "impact", "editorial", "elegant", "script", "marker", "outline", "pop"];
export const REEL_MAX_FONTS = 4;

/** What the customer picks: a caption style and their changes to it ("look"), and for "behind" the big words' fonts. */
export type ReelOptions = { style: ReelStyle; look: ReelLookChanges; fonts: ReelFont[]; emojis: boolean; zooms: boolean; sfx: boolean; hook: boolean; language: ReelLanguage };
export const REEL_DEFAULTS: ReelOptions = { style: "bold", look: {}, fonts: ["classic"], emojis: true, zooms: true, sfx: true, hook: true, language: "auto" };

/** Font styles read back defensively: known ones, each once, at most REEL_MAX_FONTS, else Classic. */
export function parseFonts(value: unknown): ReelFont[] {
  const fonts = [...new Set((Array.isArray(value) ? value : [value]).filter((f): f is ReelFont => REEL_FONTS.includes(f as ReelFont)))].slice(0, REEL_MAX_FONTS);
  return fonts.length ? fonts : [...REEL_DEFAULTS.fonts];
}

/** A re-export of an edited reel (free while the upload is kept): which one, and how it went. */
export type ReelExport = { revision: number; status: "rendering" | "done" | "failed"; startedAt: string; finishedAt?: string; error?: string };

/**
 * Job.reel: the options plus the uploaded file, stored in R2 at uploads/<userId>/<random>.<ext> (kept REEL_EDIT_DAYS,
 * then the bucket's lifecycle rule deletes it), and the latest re-export.
 */
export type ReelJob = ReelOptions & { key: string; fileName: string; bytes: number; durationSec: number; width: number | null; height: number | null; export?: ReelExport };

/** How long a reel stays editable, with free re-exports: its upload is kept this long. */
export const REEL_EDIT_DAYS = 7;

/** Whether a reel can still be edited: finished, made within REEL_EDIT_DAYS, not re-exporting right now. */
export function reelEditable(job: { status: string; createdAt: Date }, reel: ReelJob | null, now = Date.now()): { ok: boolean; reason?: string } {
  if (!reel || job.status !== "SUCCEEDED") return { ok: false, reason: "Only finished reels can be edited." };
  if (now - job.createdAt.getTime() > REEL_EDIT_DAYS * 86_400_000) return { ok: false, reason: `Reels can be edited for ${REEL_EDIT_DAYS} days after they're made; this one's upload has been deleted.` };
  return { ok: true };
}

/** How far a punch-in goes: a little, a normal punch, or a lot closer. */
export type ZoomStrength = "subtle" | "medium" | "strong";
export const ZOOM_STRENGTHS: readonly ZoomStrength[] = ["subtle", "medium", "strong"];
export const ZOOM_AMOUNT: Record<ZoomStrength, number> = { subtle: 0.07, medium: 0.12, strong: 0.2 };

/** Emoji sizes (shares of sqrt(width × height)), and where they go: by the captions' position, or above or below them. */
export type EmojiSize = "s" | "m" | "l";
export type EmojiPlace = "auto" | "above" | "below";
export const EMOJI_SIZE: Record<EmojiSize, number> = { s: 0.08, m: 0.115, l: 0.155 };
export type EmojiStyle = { size: EmojiSize; place: EmojiPlace };

/**
 * A reel's editable decisions, saved after its first render (R2: jobs/<id>/edit.json) and changed in the editor. The
 * render makes the video from exactly this, so the first render and every export show what the editor shows.
 * - the spoken words with their timings (only their spelling can change), which are left out of the captions, and
 *   where a new caption line starts
 * - the highlighted words ("Behind you": a line's first is its big word), the emojis and punch-ins, each on a word
 * - sound effects, transitions and effects, each at a second (a cut, or a word as it's said)
 * - the picture's look, the hook title and its sound, and where the upload cuts from shot to shot
 * Marks on words survive a change in how words are grouped into lines.
 */
export type ReelEdit = {
  version: 1;
  /** Length in seconds, and the output frame. */
  duration: number;
  width: number;
  height: number;
  words: { text: string; start: number; end: number }[];
  hidden: number[];
  breaks: number[];
  keywords: number[];
  emojis: { word: number; emoji: string }[];
  emojiStyle: EmojiStyle;
  zooms: { word: number; strength: ZoomStrength }[];
  sounds: { at: number; sound: ReelSound }[];
  hookSound: ReelSound | null;
  effects: PlacedEffect[];
  picture: ReelPicture;
  cuts: number[];
  hook: string;
};

// What the caption fonts can draw (as the runner checks): Latin, Greek and Cyrillic letters, digits and punctuation.
const DRAWABLE = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]*$/u;
// One emoji, as Unicode recommends them (flags and keycaps too); engines without the `v` flag fall back to a looser test.
const RGI_EMOJI = (() => {
  try {
    return new RegExp("^\\p{RGI_Emoji}$", "v");
  } catch {
    return null;
  }
})();
const graphemes = (s: string) => [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s)].length;
export const isEmoji = (s: string) => (RGI_EMOJI ? RGI_EMOJI.test(s) : /^\p{Extended_Pictographic}/u.test(s) && graphemes(s) === 1);

const MAX_MARKS = 300;

/** An edit read back defensively, or null. With `original`, the words keep the original's timings and count, and its cuts. */
export function parseReelEdit(value: unknown, original?: ReelEdit): ReelEdit | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { [K in keyof ReelEdit]?: unknown } & { words?: unknown };
  if (!Array.isArray(v.words) || !v.words.length) return null;
  const base = original ?? (v as Partial<ReelEdit>);
  if (original && v.words.length !== original.words.length) return null;
  const words = (v.words as { text?: unknown; start?: unknown; end?: unknown }[]).map((w, i) => {
    const text = typeof w?.text === "string" ? w.text.replace(/\s+/g, " ").trim().slice(0, 40) : "";
    const timing = original ? original.words[i] : w;
    return { text, start: Number(timing?.start), end: Number(timing?.end) };
  });
  if (words.some((w) => !w.text || !DRAWABLE.test(w.text) || !Number.isFinite(w.start) || !Number.isFinite(w.end))) return null;
  const duration = Number(base.duration) || 0;
  const list = (x: unknown) => (Array.isArray(x) ? x : []) as Record<string, unknown>[];
  const index = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) < words.length ? (n as number) : null);
  const indices = (x: unknown) => [...new Set((Array.isArray(x) ? x : []).map(index).filter((n): n is number => n !== null))].sort((a, b) => a - b);
  const second = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= duration + 0.5 ? Math.round(n * 1000) / 1000 : null);
  // One of each mark a word (the last wins).
  const byWord = <T extends { word: number }>(marks: T[]) => [...new Map(marks.map((m) => [m.word, m])).values()].sort((a, b) => a.word - b.word).slice(0, MAX_MARKS);

  const emojis = byWord(
    list(v.emojis)
      .map((e) => ({ word: index(e?.word), emoji: typeof e?.emoji === "string" ? e.emoji.trim() : "" }))
      .filter((e): e is { word: number; emoji: string } => e.word !== null && isEmoji(e.emoji)),
  );
  // Zooms were word numbers before they had strengths.
  const zooms = byWord(
    (Array.isArray(v.zooms) ? v.zooms : [])
      .map((z) => (typeof z === "number" ? { word: index(z), strength: "medium" as ZoomStrength } : { word: index(z?.word), strength: ZOOM_STRENGTHS.includes(z?.strength) ? (z.strength as ZoomStrength) : "medium" }))
      .filter((z): z is { word: number; strength: ZoomStrength } => z.word !== null),
  );
  const sounds = list(v.sounds)
    .map((s) => ({ at: second(s?.at), sound: s?.sound }))
    .filter((s): s is { at: number; sound: ReelSound } => s.at !== null && isReelSound(s.sound))
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_MARKS);
  const effects = list(v.effects)
    .map((e) => {
      if (!isReelEffect(e?.effect)) return null;
      const spec = EFFECTS[e.effect];
      const at = second(e.at);
      const length = typeof e.length === "number" && Number.isFinite(e.length) ? Math.min(spec.max, Math.max(spec.min, Math.round(e.length * 100) / 100)) : spec.length;
      return at === null ? null : { at, effect: e.effect, length };
    })
    .filter((e): e is PlacedEffect => e !== null)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_MARKS);
  const style = (v.emojiStyle ?? {}) as Partial<EmojiStyle>;
  const cuts = (original ? original.cuts : (Array.isArray(v.cuts) ? v.cuts : []).map(second).filter((n): n is number => n !== null)).slice(0, 500);
  return {
    version: 1,
    duration,
    width: Number(base.width) || 1080,
    height: Number(base.height) || 1920,
    words,
    hidden: indices(v.hidden).filter((i) => i < words.length).slice(0, words.length - 1),
    breaks: indices(v.breaks),
    keywords: indices(v.keywords),
    emojis,
    emojiStyle: { size: style.size && style.size in EMOJI_SIZE ? style.size : "m", place: style.place === "above" || style.place === "below" ? style.place : "auto" },
    zooms,
    sounds,
    hookSound: isReelSound(v.hookSound) ? v.hookSound : null,
    effects,
    picture: parsePicture(v.picture),
    cuts: [...new Set(cuts)].sort((a, b) => a - b),
    hook: typeof v.hook === "string" ? v.hook.replace(/[\p{Extended_Pictographic}"“”]/gu, "").replace(/\s+/g, " ").trim().slice(0, 48) : "",
  };
}

function parseExport(value: unknown): ReelExport | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Partial<ReelExport>;
  if (!Number.isInteger(v.revision) || !["rendering", "done", "failed"].includes(v.status as string) || typeof v.startedAt !== "string") return undefined;
  return { revision: v.revision as number, status: v.status as ReelExport["status"], startedAt: v.startedAt, finishedAt: typeof v.finishedAt === "string" ? v.finishedAt : undefined, error: typeof v.error === "string" ? v.error : undefined };
}

// Uploads go from the browser straight to R2 through the web Worker, in parts. R2 wants every part but the last the
// same size and at least 5 MiB. Next.js cuts request bodies off at 10 MB when middleware runs (Clerk's does, on
// every API route: middlewareClientMaxBodySize), so a part is 8 MiB, well under that and the Worker's 100 MB.
export const REEL_MAX_SECONDS = 180;
export const REEL_MAX_BYTES = 500 * 1024 * 1024;
export const REEL_PART_BYTES = 8 * 1024 * 1024;
/** Accepted uploads, and the extension each is stored with. */
export const REEL_UPLOAD_TYPES = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" } as const;
export type ReelUploadType = keyof typeof REEL_UPLOAD_TYPES;

// 1 credit up to 90 seconds, 2 up to 3 minutes. Our cost is about $0.03–0.10 a reel: speech recognition, one small
// LLM call and a few minutes of container time.
const REEL_TIERS = [
  { seconds: 90, credits: 1 },
  { seconds: REEL_MAX_SECONDS, credits: 2 },
];

/** Credits for a reel of this length, or null when it's longer than we take. */
export function creditsForReel(durationSec: number): number | null {
  return REEL_TIERS.find((t) => durationSec <= t.seconds)?.credits ?? null;
}

/** The longest reel `credits` pay for. The container measures the real length and refuses anything longer (refunded). */
export function reelSecondsFor(credits: number): number {
  return [...REEL_TIERS].reverse().find((t) => credits >= t.credits)?.seconds ?? 0;
}

/** The edit plan's model: one small structured call per reel (a second one romanizes Hinglish). */
export const REEL_PLAN_MODEL = "gpt-6-luna";

/** Written by the render Worker to /workspace/reel.json. The runner answers with /workspace/result.json (a JobResult). */
export type ReelSpec = {
  jobId: string;
  /** The uploaded video, relative to /workspace. */
  input: string;
  options: ReelOptions;
  /** What the job's credits cover, plus a second of slack for how browsers measure. */
  maxSeconds: number;
  watermark: boolean;
  watermarkText: string;
  model: string;
  /**
   * A re-export of an edited reel: the words and decisions come from /workspace/edit.json (a ReelEdit) instead of
   * speech recognition and the planner.
   */
  edit?: boolean;
};

/** Job.reel read back defensively: defaults for anything missing, null when it isn't a reel. */
export function parseReel(value: unknown): ReelJob | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<ReelJob>;
  if (typeof v.key !== "string") return null;
  const flag = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
  return {
    key: v.key,
    fileName: typeof v.fileName === "string" ? v.fileName : "video",
    bytes: Number(v.bytes) || 0,
    durationSec: Number(v.durationSec) || 0,
    width: Number(v.width) || null,
    height: Number(v.height) || null,
    style: REEL_STYLES.includes(v.style as ReelStyle) ? (v.style as ReelStyle) : REEL_DEFAULTS.style,
    look: parseLookChanges(v.look),
    export: parseExport(v.export),
    fonts: parseFonts(v.fonts),
    emojis: flag(v.emojis, REEL_DEFAULTS.emojis),
    zooms: flag(v.zooms, REEL_DEFAULTS.zooms),
    sfx: flag(v.sfx, REEL_DEFAULTS.sfx),
    hook: flag(v.hook, REEL_DEFAULTS.hook),
    language: REEL_LANGUAGES.includes(v.language as ReelLanguage) ? (v.language as ReelLanguage) : REEL_DEFAULTS.language,
  };
}

/**
 * What a customer sees when a reel fails; the technical error stays in the database. The runner starts its own
 * failures with these phrases (runner/src/reel.ts).
 */
export function reelError(error: string | null | undefined): string {
  if (/^Too long/.test(error ?? "")) return "This video is longer than the credits spent on it cover (1 credit up to 90 seconds, 2 up to 3 minutes).";
  if (/^Not a video/.test(error ?? "")) return "We couldn't read that file as a video. Export it as an MP4, MOV or WebM and upload it again.";
  if (/^No speech/.test(error ?? "")) return "We couldn't hear anyone speaking in this video, so there was nothing to caption.";
  if (/^Unsupported language/.test(error ?? "")) return "Captions work for English and Hinglish for now. Choose one of those, or try another video.";
  if (/^Upload missing/.test(error ?? "")) return "We couldn't find your upload. Please upload the video again.";
  return customerError(error);
}
