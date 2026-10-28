// The picture's look for reels: a colour filter and overlays (grain, vignette, letterbox). Each filter is one colour
// matrix with offsets, applied to gamma-encoded RGB: the render through ffmpeg's colorchannelmixer (the alpha column
// carries the offsets), the editor through an SVG feColorMatrix in sRGB, so both land on the same colours.

export type ReelFilter = "none" | "vivid" | "warm" | "cool" | "cinematic" | "vintage" | "faded" | "bw" | "noir" | "vhs";
export const REEL_FILTERS: readonly ReelFilter[] = ["none", "vivid", "warm", "cool", "cinematic", "vintage", "faded", "bw", "noir", "vhs"];

/** The picture: a filter and how strongly it applies (0 to 1), and the overlays. */
export type ReelPicture = { filter: ReelFilter; strength: number; grain: boolean; vignette: boolean; letterbox: boolean };
export const PICTURE_DEFAULTS: ReelPicture = { filter: "none", strength: 1, grain: false, vignette: false, letterbox: false };

/** A colour matrix, row by row: [rr, rg, rb, r offset, gr, gg, gb, g offset, br, bg, bb, b offset], offsets in 0-1. */
export type Matrix = readonly number[];

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

/** `b` after `a`. */
function then(a: Matrix, b: Matrix): Matrix {
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) out.push(b[r * 4] * a[c] + b[r * 4 + 1] * a[4 + c] + b[r * 4 + 2] * a[8 + c]);
    out.push(b[r * 4] * a[3] + b[r * 4 + 1] * a[7] + b[r * 4 + 2] * a[11] + b[r * 4 + 3]);
  }
  return out;
}
const chain = (...steps: Matrix[]) => steps.reduce(then, IDENTITY);

// The steps filters are made of (CSS's filter functions, as matrices).
const saturate = (s: number): Matrix => [
  0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0,
  0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0,
  0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0,
];
const contrast = (c: number): Matrix => [c, 0, 0, 0.5 - 0.5 * c, 0, c, 0, 0.5 - 0.5 * c, 0, 0, c, 0.5 - 0.5 * c];
const gain = (r: number, g: number, b: number): Matrix => [r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0];
const lift = (r: number, g: number, b: number): Matrix => [1, 0, 0, r, 0, 1, 0, g, 0, 0, 1, b];
const sepia = (a: number): Matrix => {
  const s = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];
  const m: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) m.push((r === c ? 1 - a : 0) + a * s[r * 3 + c]);
    m.push(0);
  }
  return m;
};

export const FILTERS: Record<ReelFilter, { label: string; matrix: Matrix }> = {
  none: { label: "None", matrix: IDENTITY },
  vivid: { label: "Vivid", matrix: chain(saturate(1.35), contrast(1.08)) },
  warm: { label: "Warm", matrix: chain(gain(1.06, 1, 0.9), saturate(1.08)) },
  cool: { label: "Cool", matrix: chain(gain(0.93, 1, 1.07), lift(0, 0.005, 0.02), saturate(0.95)) },
  cinematic: { label: "Cinematic", matrix: chain(contrast(1.1), gain(1.08, 1, 0.9), lift(-0.01, 0.02, 0.05), saturate(1.05)) },
  vintage: { label: "Vintage", matrix: chain(sepia(0.35), contrast(0.9), lift(0.04, 0.03, 0.02), saturate(0.85)) },
  faded: { label: "Faded", matrix: chain(contrast(0.82), lift(0.06, 0.06, 0.07), saturate(0.8)) },
  bw: { label: "B&W", matrix: chain(saturate(0), contrast(1.1)) },
  noir: { label: "Noir", matrix: chain(saturate(0), contrast(1.45), gain(0.95, 0.95, 0.95)) },
  vhs: { label: "VHS", matrix: chain(contrast(0.92), lift(0.03, 0.02, 0.04), saturate(1.15), gain(1.03, 0.97, 1.05)) },
};

/** A filter's matrix at a strength (0 none, 1 full), or null when it changes nothing. */
export function gradeMatrix(filter: ReelFilter, strength: number): Matrix | null {
  if (filter === "none" || strength <= 0) return null;
  const k = Math.min(1, strength);
  return FILTERS[filter].matrix.map((v, i) => IDENTITY[i] + (v - IDENTITY[i]) * k);
}

/** VHS beyond its colours: red and blue pulled apart (a share of the width), grain, and scan lines every 4 px of 1080. */
export const VHS = { rgb: 0.0035, noise: 0.35, lines: 4 / 1080, lineAlpha: 0.18 };

/** Grain's strength (ffmpeg's noise, 0-100) and the editor's overlay opacity for it. */
export const GRAIN = { strength: 12, opacity: 0.1 };

/** Letterbox bars, top and bottom, as a share of the height. */
export const LETTERBOX = 0.075;

/**
 * The vignette, as ffmpeg's vignette filter draws it: a lens's natural falloff, the picture times cos(angle × d)⁴, where d
 * is the distance from the middle over the distance to a corner (a circle, in pixels).
 */
export const VIGNETTE = { angle: Math.PI / 5 };
export const vignetteAlpha = (d: number) => 1 - Math.cos(VIGNETTE.angle * Math.min(1, d)) ** 4;

/** The vignette as CSS: black, as transparent as the picture is kept, in a circle out to the farthest corner. */
export function vignetteCss(): string {
  const stops = Array.from({ length: 11 }, (_, k) => `rgb(0 0 0 / ${vignetteAlpha(k / 10).toFixed(3)}) ${k * 10}%`);
  return `radial-gradient(circle farthest-corner at 50% 50%, ${stops.join(", ")})`;
}

/** The picture read back defensively. */
export function parsePicture(value: unknown): ReelPicture {
  if (!value || typeof value !== "object") return { ...PICTURE_DEFAULTS };
  const v = value as Partial<ReelPicture>;
  return {
    filter: REEL_FILTERS.includes(v.filter as ReelFilter) ? (v.filter as ReelFilter) : "none",
    strength: typeof v.strength === "number" && v.strength >= 0 && v.strength <= 1 ? Math.round(v.strength * 100) / 100 : 1,
    grain: v.grain === true,
    vignette: v.vignette === true,
    letterbox: v.letterbox === true,
  };
}
