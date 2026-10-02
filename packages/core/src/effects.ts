// Transitions and effects for reels, as curves over time. The render turns them into ffmpeg expressions
// (runner/src/reel.ts: zoompan, eq, gblur, rgbashift, noise) and the editor's preview evaluates them every frame (CSS
// transforms, an overlay and SVG filters), from the same numbers, so an effect looks the same in both.
//
// An effect sits at a moment (a cut, or a word as it's said) and runs for its length; most build up to the moment and
// land on it, like a flash covering a cut.

import type { ReelSound } from "./sounds";

export type ReelEffect = "flash" | "pullin" | "pullout" | "shake" | "glitch" | "blur" | "blackout" | "strobe" | "pulse";
export const REEL_EFFECTS: readonly ReelEffect[] = ["flash", "pullin", "pullout", "shake", "glitch", "blur", "blackout", "strobe", "pulse"];

/** How a curve runs into a key: straight, easing in or out, both, or holding the last value and jumping at the key. */
export type Ease = "linear" | "in" | "out" | "inout" | "hold";
/** A key: when (a share of the effect's length from its moment; negative is before it), the value, and how it's reached. */
export type Key = readonly [at: number, v: number, ease?: Ease];
/** A wobble over time: a sine (a shake) or random jumps `hz` times a second (a glitch), sized by its `amp` curve. */
export type Wobble = { kind: "sine" | "jitter"; hz: number; seed: number; amp: readonly Key[] };

/**
 * What an effect does, each a curve over its length (zero outside its keys):
 * - zoom: added to the zoom (0.25 is 25% closer); dx, dy: the picture moved, as shares of the frame (zoom makes the room)
 * - white, black: the picture mixed toward white or black (0 to 1)
 * - blur: a Gaussian blur, its sigma a share of the frame's width; rgb: red and blue pulled apart, a share of the width;
 *   noise: grain (0 to 1). These three hold their values in steps (the render switches filters on and off).
 */
export type EffectSpec = {
  label: string;
  hint: string;
  /** Its length in seconds as it comes, and the slider's range. */
  length: number;
  min: number;
  max: number;
  /** The sound it brings when it's added (the customer can change or drop it). */
  sound: ReelSound | null;
  zoom?: readonly Key[];
  dx?: Wobble;
  dy?: Wobble;
  white?: readonly Key[];
  black?: readonly Key[];
  blur?: readonly Key[];
  rgb?: readonly Key[];
  noise?: readonly Key[];
};

export const EFFECTS: Record<ReelEffect, EffectSpec> = {
  flash: { label: "Flash", hint: "A white flash on the moment", length: 0.3, min: 0.1, max: 1, sound: "shutter", white: [[-0.2, 0], [0, 1], [0.1, 1], [0.8, 0]] },
  pullin: { label: "Pull in", hint: "Rushes in to the moment, then settles", length: 0.4, min: 0.2, max: 1, sound: "whoosh", zoom: [[-0.6, 0], [0, 0.25, "in"], [0.6, 0, "out"]], blur: [[-0.2, 0.005], [0.2, 0.005]] },
  pullout: { label: "Pull out", hint: "Lands close, then pulls back", length: 0.4, min: 0.2, max: 1, sound: "swoosh", zoom: [[0, 0.3], [1, 0, "out"]], blur: [[0, 0.004], [0.3, 0.004]] },
  shake: {
    label: "Shake",
    hint: "A camera shake that settles",
    length: 0.5,
    min: 0.2,
    max: 1.5,
    sound: "boom",
    zoom: [[-0.1, 0], [0, 0.07, "out"], [0.8, 0.07], [1, 0, "inout"]],
    dx: { kind: "sine", hz: 13, seed: 0, amp: [[0, 0.03], [1, 0]] },
    dy: { kind: "sine", hz: 9, seed: 1.7, amp: [[0, 0.02], [1, 0]] },
  },
  glitch: {
    label: "Glitch",
    hint: "Colour split and jumps",
    length: 0.3,
    min: 0.15,
    max: 1,
    sound: "glitch",
    zoom: [[0, 0.05], [1, 0.05]],
    dx: { kind: "jitter", hz: 18, seed: 3, amp: [[0, 0.025], [1, 0.025]] },
    rgb: [[0, 0.012], [1, 0.012]],
    noise: [[0, 0.5], [1, 0.5]],
  },
  blur: {
    label: "Blur",
    hint: "Blurs out and back on the moment",
    length: 0.4,
    min: 0.2,
    max: 1.5,
    sound: "swoosh",
    blur: [[-0.5, 0.004], [-0.25, 0.008, "hold"], [-0.1, 0.012, "hold"], [0.1, 0.008, "hold"], [0.25, 0.004, "hold"], [0.5, 0, "hold"]],
  },
  blackout: { label: "Black fade", hint: "Dips to black and back", length: 0.5, min: 0.2, max: 1.5, sound: "whoosh", black: [[-0.4, 0], [0, 1], [0.1, 1], [0.6, 0]] },
  strobe: {
    label: "Strobe",
    hint: "Three quick flashes",
    length: 0.5,
    min: 0.3,
    max: 1.5,
    sound: "shutter",
    white: [[0, 0], [0.06, 1], [0.24, 0], [0.36, 0], [0.42, 1], [0.6, 0], [0.72, 0], [0.78, 1], [0.96, 0]],
  },
  pulse: { label: "Pulse", hint: "Two beats closer, like a heartbeat", length: 0.6, min: 0.3, max: 1.5, sound: "hit", zoom: [[0, 0], [0.15, 0.07, "out"], [0.4, 0, "inout"], [0.55, 0.07, "out"], [0.9, 0, "inout"]] },
};

export const isReelEffect = (value: unknown): value is ReelEffect => typeof value === "string" && value in EFFECTS;

/** An effect placed in a reel: its moment (seconds), what it is, and how long it runs. */
export type PlacedEffect = { at: number; effect: ReelEffect; length: number };

/* ---------- evaluating ---------- */

const easeOf = (ease: Ease | undefined, p: number) => (ease === "in" ? p * p * p : ease === "out" ? 1 - (1 - p) ** 3 : ease === "inout" ? 0.5 - 0.5 * Math.cos(Math.PI * p) : p);

/** A curve's value at `x` (a share of the length from the moment): zero before its first key and from its last on. */
export function curveAt(keys: readonly Key[], x: number): number {
  if (keys.length < 2 || x < keys[0][0] || x >= keys[keys.length - 1][0]) return 0;
  for (let k = 1; k < keys.length; k++) {
    const [a, va] = keys[k - 1];
    const [b, vb, ease] = keys[k];
    if (x < b) return ease === "hold" ? va : va + (vb - va) * easeOf(ease, (x - a) / (b - a));
  }
  return 0;
}

const fract = (n: number) => n - Math.floor(n);
/** A wobble at `u` seconds from the moment (x = u / length). */
function wobbleAt(w: Wobble, u: number, x: number): number {
  const amp = curveAt(w.amp, x);
  if (!amp) return 0;
  return w.kind === "sine" ? amp * Math.sin(2 * Math.PI * w.hz * u + w.seed) : amp * (2 * fract(Math.sin((Math.floor(u * w.hz) + w.seed) * 12.9898) * 43758.5453) - 1);
}

/** What the effects do to the picture at `t`: the channels added up (white and black at most 1). */
export type EffectFrame = { zoom: number; dx: number; dy: number; white: number; black: number; blur: number; rgb: number; noise: number };

export function effectsAt(effects: readonly PlacedEffect[], t: number): EffectFrame {
  const f: EffectFrame = { zoom: 0, dx: 0, dy: 0, white: 0, black: 0, blur: 0, rgb: 0, noise: 0 };
  for (const e of effects) {
    const spec = EFFECTS[e.effect];
    const u = t - e.at;
    const x = u / e.length;
    if (x < -1 || x > 1.2) continue;
    if (spec.zoom) f.zoom += curveAt(spec.zoom, x);
    if (spec.dx) f.dx += wobbleAt(spec.dx, u, x);
    if (spec.dy) f.dy += wobbleAt(spec.dy, u, x);
    if (spec.white) f.white += curveAt(spec.white, x);
    if (spec.black) f.black += curveAt(spec.black, x);
    if (spec.blur) f.blur += curveAt(spec.blur, x);
    if (spec.rgb) f.rgb += curveAt(spec.rgb, x);
    if (spec.noise) f.noise += curveAt(spec.noise, x);
  }
  f.white = Math.min(1, f.white);
  f.black = Math.min(1, f.black);
  return f;
}

/** Where the effect starts and stops changing the picture, in seconds. */
export function effectSpan(e: PlacedEffect): [number, number] {
  const spec = EFFECTS[e.effect];
  const curves = [spec.zoom, spec.white, spec.black, spec.blur, spec.rgb, spec.noise, spec.dx?.amp, spec.dy?.amp].filter((c): c is readonly Key[] => Boolean(c?.length));
  const from = Math.min(...curves.map((c) => c[0][0]));
  const to = Math.max(...curves.map((c) => c[c.length - 1][0]));
  return [e.at + from * e.length, e.at + to * e.length];
}

/* ---------- as ffmpeg expressions ---------- */

// Numbers for ffmpeg's expression evaluator: negatives in brackets, no exponent notation.
const num = (n: number) => {
  const s = (Math.round(n * 1e6) / 1e6).toString();
  return n < 0 ? `(${s})` : s;
};

const easeExpr = (ease: Ease | undefined, p: string) =>
  ease === "in" ? `pow(${p},3)` : ease === "out" ? `(1-pow(1-${p},3))` : ease === "inout" ? `(0.5-0.5*cos(PI*${p}))` : p;

/** curveAt as an ffmpeg expression of `x` (an expression too). Empty when the curve is never on. */
export function curveExpr(keys: readonly Key[], x: string): string {
  const terms: string[] = [];
  for (let k = 1; k < keys.length; k++) {
    const [a, va] = keys[k - 1];
    const [b, vb, ease] = keys[k];
    const value = ease === "hold" ? num(va) : `(${num(va)}+${num(vb - va)}*${easeExpr(ease, `((${x}-${num(a)})/${num(b - a)})`)})`;
    if (va === 0 && (ease === "hold" || vb === 0)) continue;
    terms.push(`gte(${x},${num(a)})*lt(${x},${num(b)})*${value}`);
  }
  return terms.join("+");
}

/** A wobble as an ffmpeg expression of `u` (seconds from the moment) and `x` (u / length). */
function wobbleExpr(w: Wobble, u: string, x: string): string {
  const amp = curveExpr(w.amp, x);
  if (!amp) return "";
  if (w.kind === "sine") return `(${amp})*sin(2*PI*${num(w.hz)}*${u}+${num(w.seed)})`;
  const r = `sin((floor(${u}*${num(w.hz)})+${num(w.seed)})*12.9898)*43758.5453`;
  return `(${amp})*(2*(${r}-floor(${r}))-1)`;
}

/** One channel of all the effects as an expression of the time `t` (also an expression), or "0". */
export function channelExpr(effects: readonly PlacedEffect[], channel: "zoom" | "dx" | "dy" | "white" | "black", t: string): string {
  const terms = effects.flatMap((e) => {
    const spec = EFFECTS[e.effect];
    const u = `(${t}-${num(e.at)})`;
    const x = `(${u}/${num(e.length)})`;
    if (channel === "dx" || channel === "dy") {
      const w = spec[channel];
      return w ? [wobbleExpr(w, u, x)].filter(Boolean) : [];
    }
    const keys = spec[channel];
    return keys ? [curveExpr(keys, x)].filter(Boolean) : [];
  });
  if (!terms.length) return "0";
  const sum = terms.map((s) => `(${s})`).join("+");
  return channel === "white" || channel === "black" ? `min(1,${sum})` : sum;
}

/**
 * The stepped channels (blur, rgb, noise) as levels with the windows each is on in: the render runs one filter per level,
 * switched on in its windows (the steps of every effect at that level).
 */
export function channelSteps(effects: readonly PlacedEffect[], channel: "blur" | "rgb" | "noise"): { level: number; windows: [number, number][] }[] {
  const levels = new Map<number, [number, number][]>();
  for (const e of effects) {
    const keys = EFFECTS[e.effect][channel];
    if (!keys) continue;
    for (let k = 1; k < keys.length; k++) {
      const [a, va] = keys[k - 1];
      const [b, vb, ease] = keys[k];
      // Steps hold their value; a straight run between equal values is a step too.
      const level = ease === "hold" || va === vb ? va : (va + vb) / 2;
      if (!level) continue;
      const key = Math.round(level * 1e5) / 1e5;
      levels.set(key, [...(levels.get(key) ?? []), [e.at + a * e.length, e.at + b * e.length]]);
    }
  }
  return [...levels].map(([level, windows]) => ({ level, windows }));
}

/** "between(t,a,b)+…" for a filter's `enable`, the windows rounded to the millisecond. */
export const enableExpr = (windows: readonly [number, number][], t = "t") => windows.map(([a, b]) => `between(${t},${num(Math.max(0, a))},${num(b)})`).join("+");
