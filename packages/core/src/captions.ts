// Caption looks for reels, as data. The render (runner/src/reel.ts, drawn by libass) and the web app's previews both read
// them, so what a customer picks is what they get. A look is one of the styles below plus the customer's changes: font,
// colours, size, position, words per line, capitals, animation, a box behind the spoken word or the line, the stroke
// and shadow, and bigger key words.
//
// Sizes are shares of sqrt(width × height), so a look scales with the video. Colours are "#RRGGBB".

import { groupWords, round, type GroupOf, type PhraseLimits, type Word } from "./words";

/**
 * The caption styles. "behind" puts each line's key word huge behind the speaker (their cut-out drawn back on top), with
 * small captions in front; its big words have font styles of their own (ReelFont in reel.ts).
 */
export type ReelStyle = "bold" | "behind" | "clean" | "karaoke" | "minimal" | "box" | "highlight" | "single" | "neon" | "outline" | "news" | "retro" | "hustle" | "comic" | "glide" | "editorial" | "native" | "pill";
export const REEL_STYLES: readonly ReelStyle[] = ["bold", "hustle", "comic", "behind", "pill", "clean", "glide", "editorial", "native", "box", "highlight", "karaoke", "single", "neon", "outline", "retro", "news", "minimal"];

/**
 * Caption fonts, all free to use (OFL or Apache 2.0; runner/fonts). Inter and Montserrat come in the look's weight; the
 * others have one face each.
 */
export type CaptionFont = "inter" | "montserrat" | "poppins" | "tiktok" | "roboto" | "rubik" | "anton" | "bebas" | "oswald" | "archivo" | "bangers" | "luckiest" | "abril" | "dmserif" | "instrument" | "kaushan" | "caveat" | "marker";
export const CAPTION_FONTS: readonly CaptionFont[] = ["inter", "montserrat", "poppins", "tiktok", "roboto", "rubik", "anton", "bebas", "oswald", "archivo", "bangers", "luckiest", "abril", "dmserif", "instrument", "kaushan", "caveat", "marker"];

/** A face's weight, for the fonts that come in several (WEIGHTED_FONTS); the others have one, whatever a look asks for. */
export type CaptionWeight = "black" | "extrabold" | "semibold" | "medium" | "light";
/** The weights each weighted font has (Inter has no light: it uses medium). */
export const WEIGHTED_FONTS: Partial<Record<CaptionFont, readonly CaptionWeight[]>> = {
  inter: ["black", "extrabold", "semibold", "medium"],
  montserrat: ["black", "extrabold", "semibold", "medium", "light"],
};
/** A weight a font has: the one asked for, else the nearest lighter one it has (medium, then black, as a last resort). */
export function weightOf(font: CaptionFont, weight: CaptionWeight): CaptionWeight | null {
  const has = WEIGHTED_FONTS[font];
  if (!has) return null;
  return has.includes(weight) ? weight : has.includes("medium") ? "medium" : has[0];
}

/**
 * Each font's em as a share of the ASS font size: libass sizes a font so its Windows ascent and descent add up to the
 * size (runner/src/fonts.ts has the measurements), so a preview in CSS sets font-size to size × em.
 */
export const CAPTION_FONT_EM: Record<CaptionFont, number> = {
  inter: 0.826, montserrat: 0.64, poppins: 0.568, tiktok: 0.735, roboto: 0.833, rubik: 0.653, anton: 0.577, bebas: 0.769, oswald: 0.588,
  archivo: 0.742, bangers: 0.569, luckiest: 0.816, abril: 0.741, dmserif: 0.729, instrument: 0.769, kaushan: 0.689, caveat: 0.776, marker: 0.701,
};

/** Each font's capital height in em, so a style's letters keep their height when the customer changes its font. */
export const CAPTION_FONT_CAP: Record<CaptionFont, number> = {
  inter: 0.727, montserrat: 0.7, poppins: 0.705, tiktok: 0.705, roboto: 0.711, rubik: 0.7, anton: 0.859, bebas: 0.7, oswald: 0.81,
  archivo: 0.688, bangers: 0.74, luckiest: 0.702, abril: 0.7, dmserif: 0.66, instrument: 0.72, kaushan: 0.714, caveat: 0.72, marker: 0.74,
};
const capPixels = (font: CaptionFont) => CAPTION_FONT_CAP[font] * CAPTION_FONT_EM[font];

export type CaptionPosition = "top" | "middle" | "bottom";
export const CAPTION_POSITIONS: readonly CaptionPosition[] = ["top", "middle", "bottom"];

/**
 * Where captions sit, as a share of the video's height: "top" and "middle" hang the lines from it, "bottom" stands them
 * on it. On 9:16 (Reels, TikTok, Shorts) the bottom stops above the apps' own captions and buttons, which cover about
 * the bottom fifth; wider videos keep the subtitle-style lower area as their middle. The render and the previews both
 * place captions with this.
 */
export function captionPlace(width: number, height: number, position: CaptionPosition): number {
  const tall = height / width;
  if (tall >= 1.6) return { top: 0.2, middle: 0.5, bottom: 0.78 }[position];
  if (tall >= 1.15) return { top: 0.14, middle: 0.6, bottom: 0.86 }[position];
  if (tall >= 0.9) return { top: 0.12, middle: 0.64, bottom: 0.9 }[position];
  return { top: 0.1, middle: 0.68, bottom: 0.92 }[position];
}

/** How far a customer may move captions from their position, as a share of the height, each way. */
export const CAPTION_OFFSET = 0.3;

/** Where a look's captions sit: its position, moved by the customer's offset, kept off the frame's edges. */
export function captionY(width: number, height: number, look: Pick<CaptionLook, "position" | "offset">): number {
  return Math.min(0.92, Math.max(0.08, captionPlace(width, height, look.position) + look.offset));
}

/** How wide a caption line may be, as a share of the video's width (the apps' side buttons stay clear on 9:16). */
export function captionWidth(width: number, height: number, bar = false): number {
  const tall = height / width;
  const side = tall >= 1.6 ? 0.11 : tall >= 1.15 ? 0.08 : tall >= 0.9 ? 0.07 : 0.06;
  return (1 - 2 * side) * (bar ? 0.86 : 0.94);
}
/**
 * How words come in. Line by line: "fade", or "none". Word by word, as each is said: "pop" (the spoken word swells and
 * settles), "bounce" (it springs up past its size and back), "stomp" (it slams down from big), "rise" (it grows up from
 * its baseline), "typewriter" (words appear as they're said, letter by letter) and "reveal" (words appear as they're
 * said).
 */
export type CaptionAnimation = "pop" | "bounce" | "stomp" | "rise" | "typewriter" | "reveal" | "fade" | "none";
export const CAPTION_ANIMATIONS: readonly CaptionAnimation[] = ["pop", "bounce", "stomp", "rise", "typewriter", "reveal", "fade", "none"];
/** The animations that change the spoken word's size (none of them on a marker band, which doesn't grow with the word). */
export const SCALING_ANIMATIONS: readonly CaptionAnimation[] = ["pop", "bounce", "stomp", "rise"];
/** The animations that keep words off screen until they're said. */
export const REVEALING_ANIMATIONS: readonly CaptionAnimation[] = ["typewriter", "reveal"];
/** Typewriter's pace: a letter every this many seconds. */
export const TYPEWRITER_LETTER = 0.035;

/** Everything a caption style decides. */
export type CaptionLook = {
  font: CaptionFont;
  /** The weight, for Inter and Montserrat; the other fonts have one. */
  weight: CaptionWeight;
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
  /** Moved up (negative) or down from the position, as a share of the height (CAPTION_OFFSET at most). */
  offset: number;
  /** Words on screen at once, at most; 1 shows one word at a time. */
  words: number;
  animation: CaptionAnimation;
  /** Around the letters: a hard black outline, a soft dark halo, or nothing (the box, band and bar styles). */
  stroke: "hard" | "soft" | "none";
  /** How the spoken word shows: in the accent colour, filling in as it's said (karaoke), the others dimmed, the
   * letters drawn as outlines with the spoken word filled, or the spoken word in a heavier weight of the font. */
  fill: "solid" | "karaoke" | "dim" | "hollow" | "bold";
  /** Behind the words: the line on a box, the spoken word on a marker band, a lower-third bar, or nothing. */
  background: "none" | "box" | "band" | "bar";
  backgroundColor: string;
  /** A coloured glow (the accent) around the letters. */
  glow: boolean;
  /** A hard, unblurred drop shadow in the keyword colour, offset down-right. */
  hardShadow: boolean;
  /** The customer's stroke, when they chose one: its width as a share of the font size (0 for none). Else the style's. */
  strokeWidth?: number;
  /** The stroke's colour, when the customer chose one (else black, or the letters' own for hollow ones). */
  strokeColor?: string;
  /** The customer's shadow, when they chose one: none, a soft blurred one, or a hard one. Else the style's. */
  shadowKind?: "none" | "soft" | "hard";
  /** Key words drawn this much bigger than the rest (1: the same size). */
  keyScale: number;
};

/** The customer's stroke widths, as shares of the font size. */
export const STROKE_WIDTHS = { none: 0, thin: 0.06, thick: 0.14 } as const;
/** Bigger key words: how much bigger. */
export const BIG_KEY_SCALE = 1.25;
/** A soft or hard shadow's offset, and a soft one's blur, as shares of the font size. */
export const SHADOW = { offset: 0.06, blur: 0.12 } as const;

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Black or white, whichever reads on a colour. */
export const readableOn = (hex: string) => (luminance(hex) > 0.55 ? "#111111" : "#FFFFFF");
/** A box behind a line: see-through a little when dark (ASS alpha 0x38, 78% opaque), nearly solid when light (a white box). */
export const boxAlpha = (hex: string) => (luminance(hex) > 0.6 ? 0x08 : 0x38);

/**
 * The spoken word's scale over time for a word-by-word animation, as [ms, percent] keys from when it's said (the render
 * turns them into \t transforms, the previews into CSS keyframes), or null. Key words grow from their own size. Never on
 * a marker band, which doesn't grow with its word.
 */
export function wordMotion(look: Pick<CaptionLook, "animation" | "size" | "background">, isKey: boolean): { scale: [number, number][]; fromY?: number; fade?: number } | null {
  if (look.background === "band") return null;
  switch (look.animation) {
    case "pop": {
      const peak = look.size >= 0.06 ? (isKey ? 124 : 114) : 108;
      return { scale: [[0, peak], [110, 100]] };
    }
    case "bounce":
      return { scale: [[0, 72], [90, 118], [180, 100]] };
    case "stomp":
      return { scale: [[0, 150], [90, 100]] };
    case "rise":
      // Grows up from its baseline: only its height scales, from a fifth; and it fades in.
      return { scale: [[0, 100], [120, 100]], fromY: 20, fade: 120 };
    default:
      return null;
  }
}

const WHITE = "#FFFFFF";
const YELLOW = "#FFD60A";
const GREEN = "#3BF26B";
const LIME = "#C6FF3D";

// The five original styles keep their look exactly; the rest are new. Words per line: 4 for big type, 6 for sentences.
const base = { font: "inter", animation: "pop", stroke: "hard", fill: "solid", background: "none", backgroundColor: "#000000", glow: false, hardShadow: false, offset: 0, keyScale: 1 } as const;
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
  // The trending looks (gap analysis, Oct 2026), in free fonts: the "Hormozi" caption, the "MrBeast" one, light-to-bold
  // lowercase, editorial serif italic, TikTok's own text on a white box, and the spoken word on a coloured pill.
  hustle: { ...base, font: "montserrat", weight: "black", casing: "upper", size: 0.085, color: WHITE, accent: YELLOW, keyword: GREEN, position: "middle", words: 3, animation: "rise" },
  comic: { ...base, font: "bangers", weight: "black", casing: "upper", size: 0.1, color: WHITE, accent: YELLOW, keyword: GREEN, position: "middle", words: 2, animation: "bounce" },
  glide: { ...base, font: "montserrat", weight: "light", casing: "lower", size: 0.062, color: WHITE, accent: WHITE, keyword: WHITE, position: "middle", words: 5, stroke: "soft", fill: "bold", animation: "fade" },
  editorial: { ...base, font: "instrument", weight: "black", casing: "as-said", size: 0.064, color: "#FFF6E8", accent: "#FFD27A", keyword: "#FFD27A", position: "middle", words: 4, stroke: "soft", animation: "rise" },
  native: { ...base, font: "tiktok", weight: "black", casing: "as-said", size: 0.054, color: "#111111", accent: "#FE2C55", keyword: "#FE2C55", position: "middle", words: 5, stroke: "none", background: "box", backgroundColor: WHITE },
  pill: { ...base, font: "poppins", weight: "black", casing: "as-said", size: 0.078, color: WHITE, accent: WHITE, keyword: YELLOW, position: "middle", words: 3, background: "band", backgroundColor: "#2F6BFF", animation: "none" },
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
  hustle: { outline: 0.08, shadow: 0.06, halo: 0, back: 0 },
  comic: { outline: 0.14, shadow: 0.06, halo: 0, back: 0 },
  glide: { outline: 0.09, shadow: 0.05, halo: 0x50, back: 0x70 },
  editorial: { outline: 0.08, shadow: 0.05, halo: 0x50, back: 0x70 },
  native: { outline: 0, shadow: 0, halo: 0, back: 0xff },
  pill: { outline: 0.06, shadow: 0.04, halo: 0, back: 0x60 },
};

// How each style groups words: at most this many words, characters and seconds a line, a new line after a pause this
// long, and the line held this long after its last word. Changing words-per-line scales the first three.
export const CAPTION_LIMITS: Record<ReelStyle, PhraseLimits> = {
  bold: { maxWords: 4, maxChars: 15, maxSeconds: 1.5, pause: 0.4, hold: 0.5 },
  behind: { maxWords: 4, maxChars: 24, maxSeconds: 2.2, pause: 0.45, hold: 0.5 },
  clean: { maxWords: 6, maxChars: 30, maxSeconds: 2.6, pause: 0.5, hold: 0.6 },
  karaoke: { maxWords: 6, maxChars: 28, maxSeconds: 3, pause: 0.6, hold: 0.6 },
  minimal: { maxWords: 5, maxChars: 26, maxSeconds: 2.4, pause: 0.5, hold: 0.6 },
  box: { maxWords: 5, maxChars: 26, maxSeconds: 2.2, pause: 0.5, hold: 0.5 },
  highlight: { maxWords: 4, maxChars: 16, maxSeconds: 1.6, pause: 0.4, hold: 0.5 },
  single: { maxWords: 1, maxChars: 14, maxSeconds: 0.9, pause: 0.3, hold: 0.3 },
  neon: { maxWords: 4, maxChars: 18, maxSeconds: 1.8, pause: 0.45, hold: 0.5 },
  outline: { maxWords: 4, maxChars: 15, maxSeconds: 1.5, pause: 0.4, hold: 0.5 },
  news: { maxWords: 7, maxChars: 38, maxSeconds: 3, pause: 0.6, hold: 0.6 },
  retro: { maxWords: 4, maxChars: 16, maxSeconds: 1.6, pause: 0.4, hold: 0.5 },
  hustle: { maxWords: 3, maxChars: 14, maxSeconds: 1.4, pause: 0.4, hold: 0.5 },
  comic: { maxWords: 2, maxChars: 12, maxSeconds: 1.1, pause: 0.35, hold: 0.45 },
  glide: { maxWords: 5, maxChars: 28, maxSeconds: 2.4, pause: 0.5, hold: 0.6 },
  editorial: { maxWords: 4, maxChars: 24, maxSeconds: 2.2, pause: 0.45, hold: 0.55 },
  native: { maxWords: 5, maxChars: 28, maxSeconds: 2.4, pause: 0.5, hold: 0.6 },
  pill: { maxWords: 3, maxChars: 16, maxSeconds: 1.5, pause: 0.4, hold: 0.5 },
};

/** A look's line limits: the style's own, scaled when the customer changes how many words go on screen. */
export function captionLimits(style: ReelStyle, look: CaptionLook): PhraseLimits {
  const preset = CAPTION_LIMITS[style];
  const k = look.words / CAPTION_STYLES[style].words;
  if (k === 1) return preset;
  return { ...preset, maxWords: look.words, maxChars: Math.max(8, Math.round(preset.maxChars * k)), maxSeconds: Math.max(0.6, round(preset.maxSeconds * Math.sqrt(k))) };
}

/** Captions go up a beat before the word is heard, as editors set them: to the eye they're then on time. */
export const CAPTION_LEAD = 0.1;

/** A word on a caption line, timed a beat ahead of the voice, with its place in the reel's words (`i`, what marks point at). */
export type CaptionWord = Word & { i: number };
export type CaptionLine = GroupOf<CaptionWord>;

/** The customer's changes to how words become lines: words left out of the captions, and words that start a line. */
export type LineEdits = { hidden?: readonly number[]; breaks?: readonly number[] };

/**
 * The caption lines for spoken words in a look, a beat ahead of the voice: one line per word for "One word" (grouping
 * would join a lone last word to its line), else grouped as the style groups them, with a new line wherever one was
 * asked for. Hidden words are left out (still heard). The render and the web app's editor both use this.
 */
export function captionLines(words: Word[], style: ReelStyle, look: CaptionLook, edits: LineEdits = {}): CaptionLine[] {
  const hidden = new Set(edits.hidden ?? []);
  const cued = words
    .map((w, i) => ({ ...w, i, start: cueOf(words, i), end: round(Math.max(0.05, w.end - CAPTION_LEAD)) }))
    .filter((w) => !hidden.has(w.i));
  const limits = captionLimits(style, look);
  if (look.words !== 1) {
    const breaks = new Set(edits.breaks ?? []);
    return groupWords(cued, new Set(cued.flatMap((w, p) => (p > 0 && breaks.has(w.i) ? [p - 1] : []))), limits);
  }
  return cued.map((w, p) => {
    const next = cued[p + 1]?.start ?? Infinity;
    const end = next - w.end < limits.pause ? next : w.end + limits.hold;
    return { start: w.start, end: round(Math.max(w.end, end)), text: w.text, words: [w] };
  });
}

/** When a word's caption shows: a beat ahead of the voice (for a hidden word too: its emoji or sound keeps its time). */
export const cueOf = (words: readonly Word[], word: number) => round(Math.max(0, words[word].start - CAPTION_LEAD));

/** The line a word is on (an index into `lines`), or -1 when it's hidden. */
export const lineOfWord = (lines: readonly CaptionLine[], word: number) => lines.findIndex((l) => l.words.some((w) => w.i === word));

/** The line on screen at `time`, or -1. */
export const lineAtTime = (lines: readonly CaptionLine[], time: number) => lines.findIndex((l) => time >= l.start && time < l.end);

/** What a customer changed about a style. Size is a multiple of the style's own (0.8 to 1.5). */
export type ReelLookChanges = {
  font?: CaptionFont;
  color?: string;
  accent?: string;
  size?: number;
  position?: CaptionPosition;
  /** Moved from the position: a share of the height, CAPTION_OFFSET at most either way. */
  offset?: number;
  words?: number;
  caps?: boolean;
  animation?: CaptionAnimation;
  /** Behind the words: nothing, a box behind the spoken word, or a box behind the whole line. */
  back?: "none" | "word" | "line";
  /** Around the letters: none, thin or thick; and its colour. */
  stroke?: "none" | "thin" | "thick";
  strokeColor?: string;
  /** Under the letters: none, a soft shadow or a hard one. */
  shadow?: "none" | "soft" | "hard";
  /** Key words bigger than the rest. */
  bigKeys?: boolean;
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
  // Behind the words, before the highlight colour (which colours a box behind the spoken word). A box behind the spoken
  // word takes the style's highlight colour (yellow when that's white), and the word on it reads in black or white; it
  // replaces karaoke's fill and hollow letters, which it would cover.
  if (changes.back === "word" && look.background !== "band") {
    look.background = "band";
    look.backgroundColor = look.accent.toUpperCase() === WHITE ? YELLOW : look.accent;
    look.accent = readableOn(look.backgroundColor);
    if (look.fill === "karaoke" || look.fill === "hollow") look.fill = "solid";
  } else if (changes.back === "line" && look.background !== "box") {
    look.background = "box";
    look.backgroundColor = "#000000";
  } else if (changes.back === "none") look.background = "none";
  // One highlight colour: the spoken word and the key word (the box behind the spoken word, when there is one).
  if (changes.accent) {
    if (look.background === "band") {
      look.backgroundColor = changes.accent;
      look.accent = readableOn(changes.accent);
    } else look.accent = look.keyword = changes.accent;
    if (look.fill === "hollow" || look.glow || look.hardShadow) look.keyword = changes.accent;
  }
  if (changes.size) look.size *= changes.size;
  if (changes.position) look.position = changes.position;
  if (changes.offset) look.offset = changes.offset;
  if (changes.words) look.words = changes.words;
  if (changes.caps !== undefined) look.casing = changes.caps ? "upper" : look.casing === "upper" ? "as-said" : look.casing;
  if (changes.animation) look.animation = changes.animation;
  if (changes.stroke) {
    look.stroke = changes.stroke === "none" ? "none" : "hard";
    look.strokeWidth = STROKE_WIDTHS[changes.stroke];
  }
  if (changes.strokeColor) look.strokeColor = changes.strokeColor;
  if (changes.shadow) look.shadowKind = changes.shadow;
  if (changes.bigKeys) look.keyScale = BIG_KEY_SCALE;
  // Words on a box stay readable: a colour too close to the box's takes the style's own, or black or white.
  if (look.background === "box") {
    const box = luminance(look.backgroundColor);
    const clashes = (hex: string, margin: number) => Math.abs(luminance(hex) - box) < margin;
    if (clashes(look.color, 0.35)) look.color = readableOn(look.backgroundColor);
    if (clashes(look.accent, 0.25)) look.accent = clashes(CAPTION_STYLES[style].accent, 0.25) ? readableOn(look.backgroundColor) : CAPTION_STYLES[style].accent;
    if (clashes(look.keyword, 0.25)) look.keyword = look.accent;
  }
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
  if (typeof v.offset === "number" && Math.abs(v.offset) <= CAPTION_OFFSET && v.offset !== 0) out.offset = Math.round(v.offset * 1000) / 1000;
  if (Number.isInteger(v.words) && (v.words as number) >= CAPTION_WORDS.min && (v.words as number) <= CAPTION_WORDS.max) out.words = v.words as number;
  if (typeof v.caps === "boolean") out.caps = v.caps;
  if (CAPTION_ANIMATIONS.includes(v.animation as CaptionAnimation)) out.animation = v.animation as CaptionAnimation;
  if (v.back === "none" || v.back === "word" || v.back === "line") out.back = v.back;
  if (v.stroke === "none" || v.stroke === "thin" || v.stroke === "thick") out.stroke = v.stroke;
  if (typeof v.strokeColor === "string" && HEX.test(v.strokeColor)) out.strokeColor = v.strokeColor.toUpperCase();
  if (v.shadow === "none" || v.shadow === "soft" || v.shadow === "hard") out.shadow = v.shadow;
  if (v.bigKeys === true) out.bigKeys = true;
  return out;
}
