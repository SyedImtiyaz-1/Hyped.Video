// Reel help: a customer uploads a short video they recorded (a talking-head reel, a Short, a product demo) and gets it
// back with word-by-word captions, keyword emphasis, emojis, punch-in zooms, sound effects and an optional hook title.
// Shared by the web app (options, prices, upload limits), the render Worker and the runner (runner/src/reel.ts).
// No Prisma here: the browser and the container import it.
import { customerError } from "./engines";

/**
 * Caption looks: Hormozi-style bold words, clean sentences, a karaoke fill, small lowercase in the lower third, or
 * "behind": the hook and each line's key word huge and behind the speaker (their cut-out drawn back on top), with
 * clean captions in front.
 */
export type ReelStyle = "bold" | "clean" | "karaoke" | "minimal" | "behind";
export const REEL_STYLES: readonly ReelStyle[] = ["bold", "behind", "clean", "karaoke", "minimal"];

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

/** What the customer picks. */
export type ReelOptions = { style: ReelStyle; fonts: ReelFont[]; emojis: boolean; zooms: boolean; sfx: boolean; hook: boolean; language: ReelLanguage };
export const REEL_DEFAULTS: ReelOptions = { style: "bold", fonts: ["classic"], emojis: true, zooms: true, sfx: true, hook: true, language: "auto" };

/** Font styles read back defensively: known ones, each once, at most REEL_MAX_FONTS, else Classic. */
export function parseFonts(value: unknown): ReelFont[] {
  const fonts = [...new Set((Array.isArray(value) ? value : [value]).filter((f): f is ReelFont => REEL_FONTS.includes(f as ReelFont)))].slice(0, REEL_MAX_FONTS);
  return fonts.length ? fonts : [...REEL_DEFAULTS.fonts];
}

/** Job.reel: the options plus the uploaded file, stored in R2 at uploads/<userId>/<random>.<ext>. */
export type ReelJob = ReelOptions & { key: string; fileName: string; bytes: number; durationSec: number; width: number | null; height: number | null };

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
