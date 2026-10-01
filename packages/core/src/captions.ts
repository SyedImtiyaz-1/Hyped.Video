// Caption looks for reels, as data. The render (runner/src/reel.ts, drawn by libass) and the web app's previews both read
// them, so what a customer picks is what they get. A look is one of the styles below plus the customer's changes: font,
// colours, size, position, words per line, capitals and animation.
//
// Sizes are shares of sqrt(width × height), so a look scales with the video. Colours are "#RRGGBB".

/**
 * The caption styles. "behind" puts each line's key word huge behind the speaker (their cut-out drawn back on top), with
 * small captions in front; its big words have font styles of their own (ReelFont in reel.ts).
 */
export type ReelStyle = "bold" | "behind" | "clean" | "karaoke" | "minimal" | "box" | "highlight" | "single" | "neon" | "outline" | "news" | "retro";
export const REEL_STYLES: readonly ReelStyle[] = ["bold", "behind", "clean", "box", "highlight", "karaoke", "single", "neon", "outline", "retro", "news", "minimal"];

/** Caption fonts. Inter comes in the style's own weight; the others have one. */
export type CaptionFont = "inter" | "anton" | "abril" | "dmserif" | "kaushan" | "marker" | "archivo";
export const CAPTION_FONTS: readonly CaptionFont[] = ["inter", "anton", "archivo", "abril", "dmserif", "kaushan", "marker"];

/**
 * Each font's em as a share of the ASS font size: libass sizes a font so its Windows ascent and descent add up to the
 * size (runner/src/fonts.ts has the measurements), so a preview in CSS sets font-size to size × em.
 */
export const CAPTION_FONT_EM: Record<CaptionFont, number> = { inter: 0.826, anton: 0.577, abril: 0.741, archivo: 0.742, dmserif: 0.729, kaushan: 0.689, marker: 0.701 };

/** Each font's capital height in em, so a style's letters keep their height when the customer changes its font. */
export const CAPTION_FONT_CAP: Record<CaptionFont, number> = { inter: 0.727, anton: 0.859, abril: 0.7, archivo: 0.688, dmserif: 0.66, kaushan: 0.714, marker: 0.74 };
const capPixels = (font: CaptionFont) => CAPTION_FONT_CAP[font] * CAPTION_FONT_EM[font];

export type CaptionPosition = "top" | "middle" | "bottom";
export const CAPTION_POSITIONS: readonly CaptionPosition[] = ["top", "middle", "bottom"];
export type CaptionAnimation = "pop" | "fade" | "none";
export const CAPTION_ANIMATIONS: readonly CaptionAnimation[] = ["pop", "fade", "none"];

/** Everything a caption style decides. */
export type CaptionLook = {
  font: CaptionFont;
  /** Inter's weight; the other fonts have one. */
  weight: "black" | "extrabold" | "semibold" | "medium";
  /** Capitals, lower case, or as said. */
  casing: "upper" | "lower" | "as-said";
  size: number;
  /** The words. */
  color: string;
  /** The word being said. */
  accent: string;
  /** The line's key word, when it isn't being said. */
  keyword: string;
  position: CaptionPosition;
  /** Words on screen at once, at most; 1 shows one word at a time. */
  words: number;
  animation: CaptionAnimation;
  /** Around the letters: a hard black outline, a soft dark halo, or nothing (the box, band and bar styles). */
  stroke: "hard" | "soft" | "none";
  /** How the spoken word shows: in the accent colour, filling in as it's said (karaoke), the others dimmed, or the
   * letters drawn as outlines with the spoken word filled. */
  fill: "solid" | "karaoke" | "dim" | "hollow";
  /** Behind the words: the line on a box, the spoken word on a marker band, a lower-third bar, or nothing. */
  background: "none" | "box" | "band" | "bar";
  backgroundColor: string;
  /** A coloured glow (the accent) around the letters. */
  glow: boolean;
  /** A hard, unblurred drop shadow in the keyword colour, offset down-right. */
  hardShadow: boolean;
};

const WHITE = "#FFFFFF";
const YELLOW = "#FFD60A";
const GREEN = "#3BF26B";
const LIME = "#C6FF3D";

// The five original styles keep their look exactly; the rest are new. Words per line: 4 for big type, 6 for sentences.
const base = { font: "inter", animation: "pop", stroke: "hard", fill: "solid", background: "none", backgroundColor: "#000000", glow: false, hardShadow: false } as const;
export const CAPTION_STYLES: Record<ReelStyle, CaptionLook> = {
  bold: { ...base, weight: "black", casing: "upper", size: 0.066, color: WHITE, accent: YELLOW, keyword: GREEN, position: "middle", words: 4 },
  behind: { ...base, weight: "extrabold", casing: "as-said", size: 0.05, color: WHITE, accent: WHITE, keyword: WHITE, position: "middle", words: 4, stroke: "soft", animation: "fade" },
  clean: { ...base, weight: "semibold", casing: "as-said", size: 0.047, color: WHITE, accent: YELLOW, keyword: WHITE, position: "middle", words: 6, stroke: "soft" },
  karaoke: { ...base, weight: "extrabold", casing: "as-said", size: 0.06, color: WHITE, accent: YELLOW, keyword: GREEN, position: "middle", words: 6, fill: "karaoke" },
  minimal: { ...base, weight: "medium", casing: "lower", size: 0.043, color: WHITE, accent: WHITE, keyword: WHITE, position: "bottom", words: 5, stroke: "soft", fill: "dim", animation: "fade" },
  box: { ...base, weight: "extrabold", casing: "as-said", size: 0.05, color: WHITE, accent: YELLOW, keyword: WHITE, position: "middle", words: 5, stroke: "none", background: "box", backgroundColor: "#000000" },
  highlight: { ...base, weight: "black", casing: "upper", size: 0.058, color: WHITE, accent: "#10140A", keyword: WHITE, position: "middle", words: 4, background: "band", backgroundColor: LIME, animation: "none" },
  single: { ...base, weight: "black", casing: "upper", size: 0.1, color: WHITE, accent: WHITE, keyword: YELLOW, position: "middle", words: 1 },
  neon: { ...base, weight: "extrabold", casing: "upper", size: 0.06, color: WHITE, accent: "#FF4FD8", keyword: "#FF4FD8", position: "middle", words: 4, stroke: "none", glow: true },
  outline: { ...base, weight: "black", casing: "upper", size: 0.066, color: WHITE, accent: WHITE, keyword: WHITE, position: "middle", words: 4, stroke: "none", fill: "hollow" },
  news: { ...base, weight: "semibold", casing: "as-said", size: 0.042, color: WHITE, accent: YELLOW, keyword: WHITE, position: "bottom", words: 7, stroke: "none", background: "bar", backgroundColor: "#111318", animation: "fade" },
  retro: { ...base, font: "archivo", weight: "black", casing: "upper", size: 0.062, color: "#FFF4D6", accent: YELLOW, keyword: "#FF4D6D", position: "middle", words: 4, stroke: "none", hardShadow: true },
};

// Around the letters, as shares of the font size: outline width, shadow offset, and the outline's and shadow's alpha
// (0 opaque). The original styles keep their exact values.
export const CAPTION_STROKES: Record<ReelStyle, { outline: number; shadow: number; halo: number; back: number }> = {
  bold: { outline: 0.1, shadow: 0.05, halo: 0, back: 0 },
  behind: { outline: 0.09, shadow: 0.05, halo: 0x50, back: 0x70 },
  clean: { outline: 0.09, shadow: 0.05, halo: 0x50, back: 0x70 },
  karaoke: { outline: 0.075, shadow: 0.04, halo: 0, back: 0x70 },
  minimal: { outline: 0.08, shadow: 0.04, halo: 0x60, back: 0x70 },
  box: { outline: 0, shadow: 0, halo: 0, back: 0xff },
  highlight: { outline: 0.06, shadow: 0.04, halo: 0, back: 0x60 },
  single: { outline: 0.09, shadow: 0.05, halo: 0, back: 0 },
  neon: { outline: 0, shadow: 0, halo: 0, back: 0xff },
  outline: { outline: 0.05, shadow: 0.03, halo: 0, back: 0x80 },
  news: { outline: 0, shadow: 0, halo: 0, back: 0xff },
  retro: { outline: 0, shadow: 0.07, halo: 0, back: 0 },
};

/** What a customer changed about a style. Size is a multiple of the style's own (0.8 to 1.5). */
export type ReelLookChanges = {
  font?: CaptionFont;
  color?: string;
  accent?: string;
  size?: number;
  position?: CaptionPosition;
  words?: number;
  caps?: boolean;
  animation?: CaptionAnimation;
};

export const CAPTION_SIZE = { min: 0.8, max: 1.5 } as const;
export const CAPTION_WORDS = { min: 1, max: 7 } as const;

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** A style with a customer's changes applied. */
export function resolveLook(style: ReelStyle, changes: ReelLookChanges = {}): CaptionLook {
  const look = { ...CAPTION_STYLES[style] };
  // A new font at the same size would come out taller or shorter: keep the style's capital height.
  if (changes.font && changes.font !== look.font) {
    look.size *= capPixels(look.font) / capPixels(changes.font);
    look.font = changes.font;
  }
  if (changes.color) look.color = changes.color;
  // One highlight colour: the spoken word and the key word (the marker band, for the highlight style).
  if (changes.accent) {
    if (look.background === "band") look.backgroundColor = changes.accent;
    else look.accent = look.keyword = changes.accent;
    if (look.fill === "hollow" || look.glow || look.hardShadow) look.keyword = changes.accent;
  }
  if (changes.size) look.size *= changes.size;
  if (changes.position) look.position = changes.position;
  if (changes.words) look.words = changes.words;
  if (changes.caps !== undefined) look.casing = changes.caps ? "upper" : look.casing === "upper" ? "as-said" : look.casing;
  if (changes.animation) look.animation = changes.animation;
  return look;
}

/** Changes read back defensively (from a request or the database): anything unknown or out of range is dropped. */
export function parseLookChanges(value: unknown): ReelLookChanges {
  if (!value || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  const out: ReelLookChanges = {};
  if (CAPTION_FONTS.includes(v.font as CaptionFont)) out.font = v.font as CaptionFont;
  if (typeof v.color === "string" && HEX.test(v.color)) out.color = v.color.toUpperCase();
  if (typeof v.accent === "string" && HEX.test(v.accent)) out.accent = v.accent.toUpperCase();
  if (typeof v.size === "number" && v.size >= CAPTION_SIZE.min && v.size <= CAPTION_SIZE.max) out.size = Math.round(v.size * 100) / 100;
  if (CAPTION_POSITIONS.includes(v.position as CaptionPosition)) out.position = v.position as CaptionPosition;
  if (Number.isInteger(v.words) && (v.words as number) >= CAPTION_WORDS.min && (v.words as number) <= CAPTION_WORDS.max) out.words = v.words as number;
  if (typeof v.caps === "boolean") out.caps = v.caps;
  if (CAPTION_ANIMATIONS.includes(v.animation as CaptionAnimation)) out.animation = v.animation as CaptionAnimation;
  return out;
}
