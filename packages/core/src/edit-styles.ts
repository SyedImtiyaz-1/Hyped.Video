// Edit styles: a whole look for a reel in one pick, the way Captions' AI Edit styles work: the caption style and its
// changes, the extras, how much dead air is cut, the picture's grade, what happens at the cuts, and the music bed. A
// strength says how much happens (fewer or more punch-ins, emojis and sounds, and effects on the cuts). Every part stays
// changeable afterwards, in the form and in the editor; the style is only where the first render starts.
import type { ReelLookChanges, ReelStyle } from "./captions";
import type { ReelEffect } from "./effects";
import type { ReelMusic } from "./music-beds";
import type { ReelPicture } from "./picture";
import type { ReelFont, ZoomStrength } from "./reel";
import type { ReelCleanup } from "./trims";

export type ReelEditStyle = "creator" | "clean" | "podcast" | "hype" | "cinematic" | "behind";
export const REEL_EDIT_STYLES: readonly ReelEditStyle[] = ["creator", "clean", "podcast", "hype", "cinematic", "behind"];

export type ReelStrength = "light" | "medium" | "strong";
export const REEL_STRENGTHS: readonly ReelStrength[] = ["light", "medium", "strong"];

export type EditStyleSpec = {
  label: string;
  hint: string;
  /** What the style sets in the reel's options. */
  options: { style: ReelStyle; look: ReelLookChanges; fonts: ReelFont[]; emojis: boolean; zooms: boolean; sfx: boolean; hook: boolean; cleanup: ReelCleanup };
  /** The picture's grade and overlays. */
  picture: Partial<ReelPicture>;
  /** An effect on the jump cuts the cleanup makes (none on light strength). */
  cutEffect: ReelEffect | null;
  music: { track: ReelMusic; volume: number } | null;
};

export const EDIT_STYLES: Record<ReelEditStyle, EditStyleSpec> = {
  creator: {
    label: "Creator",
    hint: "Bold captions, emojis, punch-ins and sound effects",
    options: { style: "bold", look: {}, fonts: ["classic"], emojis: true, zooms: true, sfx: true, hook: true, cleanup: "pauses" },
    picture: {},
    cutEffect: null,
    music: null,
  },
  clean: {
    label: "Clean",
    hint: "Simple captions and gentle punch-ins, nothing loud",
    options: { style: "clean", look: {}, fonts: ["classic"], emojis: false, zooms: true, sfx: false, hook: false, cleanup: "pauses" },
    picture: {},
    cutEffect: null,
    music: null,
  },
  podcast: {
    label: "Podcast",
    hint: "Karaoke captions over a calm music bed, tightly cut",
    options: { style: "karaoke", look: {}, fonts: ["classic"], emojis: false, zooms: true, sfx: false, hook: true, cleanup: "full" },
    picture: {},
    cutEffect: null,
    music: { track: "calm", volume: 0.35 },
  },
  hype: {
    label: "Hype",
    hint: "Neon captions, flashes on the cuts and upbeat music",
    options: { style: "neon", look: {}, fonts: ["classic"], emojis: true, zooms: true, sfx: true, hook: true, cleanup: "full" },
    picture: { filter: "vivid", strength: 0.8 },
    cutEffect: "flash",
    music: { track: "upbeat", volume: 0.5 },
  },
  cinematic: {
    label: "Cinematic",
    hint: "Serif captions, a film grade with letterbox, soft dips to black",
    options: { style: "minimal", look: { font: "dmserif" }, fonts: ["elegant"], emojis: false, zooms: true, sfx: false, hook: false, cleanup: "pauses" },
    picture: { filter: "cinematic", strength: 1, vignette: true, letterbox: true },
    cutEffect: "blackout",
    music: { track: "calm", volume: 0.4 },
  },
  behind: {
    label: "Behind you",
    hint: "Huge words behind the speaker, with punch-ins and sounds",
    options: { style: "behind", look: {}, fonts: ["impact", "classic"], emojis: false, zooms: true, sfx: true, hook: true, cleanup: "pauses" },
    picture: {},
    cutEffect: null,
    music: null,
  },
};

export const STRENGTH_LABEL: Record<ReelStrength, { label: string; hint: string }> = {
  light: { label: "Light", hint: "A few punch-ins and highlights; nothing on the cuts" },
  medium: { label: "Medium", hint: "A punch-in about every 7 seconds, an emoji every 8" },
  strong: { label: "Strong", hint: "More of everything, and an effect on most cuts" },
};

/** How much the plan asks for, against medium: punch-ins, emojis, highlights and sound effects. */
export const STRENGTH_DENSITY: Record<ReelStrength, number> = { light: 0.5, medium: 1, strong: 1.6 };
/** How far the punch-ins go. */
export const STRENGTH_ZOOM: Record<ReelStrength, ZoomStrength> = { light: "subtle", medium: "medium", strong: "strong" };
/** Effects on the cuts: at most one every this many seconds of the cut video (none on light). */
export const STRENGTH_CUT_GAP: Record<ReelStrength, number | null> = { light: null, medium: 6, strong: 3 };

export const isEditStyle = (v: unknown): v is ReelEditStyle => REEL_EDIT_STYLES.includes(v as ReelEditStyle);
export const isStrength = (v: unknown): v is ReelStrength => REEL_STRENGTHS.includes(v as ReelStrength);
