"use client";
import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { boxAlpha, CAPTION_FONT_EM, CAPTION_STROKES, captionWidth, captionY, REVEALING_ANIMATIONS, SHADOW, TYPEWRITER_LETTER, weightOf, wordMotion, type CaptionLook, type CaptionWeight, type ReelStyle } from "@launchreel/core/captions";
import { cn } from "@/lib/cn";
import { CAPTION_FONT_CLASS } from "./caption-fonts";

// A sample line, said a word at a time, with two key words. Twelve words split evenly into lines of 1, 2, 3, 4 or 6.
const SAMPLE = ["Here's", "how", "I", "doubled", "my", "sales", "in", "30", "days", "without", "any", "ads"];
const KEYWORDS = new Set([3, 7]);
const WEIGHT: Record<CaptionWeight, number> = { black: 900, extrabold: 800, semibold: 600, medium: 500, light: 300 };

/** "#RRGGBB" at an opacity, as CSS. */
const rgba = (hex: string, opacity: number) => `rgb(${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)} / ${opacity})`;

let canvas: CanvasRenderingContext2D | null = null;

/**
 * Where a caption breaks and how far it shrinks, the way the render does (lineBreak in runner/src/reel.ts): one line if
 * it fits, else the two most even lines, smaller if even those are too wide. From each word's width in the real font.
 */
function fitLines(widths: number[], space: number, max: number): { breakAt: number | null; scale: number } {
  if (!widths.length) return { breakAt: null, scale: 1 };
  const width = (from: number, to: number) => widths.slice(from, to).reduce((w, x, i) => w + x + (i > 0 ? space : 0), 0);
  const all = width(0, widths.length);
  if (widths.length < 2 || all <= max) return { breakAt: null, scale: Math.min(1, max / all) };
  let best = { breakAt: 1, widest: Infinity };
  for (let k = 1; k < widths.length; k++) {
    const widest = Math.max(width(0, k), width(k, widths.length));
    if (widest < best.widest) best = { breakAt: k, widest };
  }
  return { breakAt: best.breakAt, scale: Math.min(1, max / best.widest) };
}

/** A word-by-word animation (wordMotion, shared with the render) as CSS keyframes, named for what they do. */
function motionKeyframes(look: CaptionLook, isKey: boolean): { name: string; css: string; ms: number; rises: boolean } | null {
  const motion = wordMotion(look, isKey);
  if (!motion) return null;
  const ms = motion.scale[motion.scale.length - 1][0];
  const name = `reel-w-${motion.scale.map(([t, v]) => `${t}-${v}`).join("-")}-${motion.fromY ?? 0}`;
  const frames = motion.fromY
    ? `0%{transform:scaleY(${motion.fromY / 100});opacity:0}100%{transform:scaleY(1);opacity:1}`
    : motion.scale.map(([t, v]) => `${((t / ms) * 100).toFixed(1)}%{transform:scale(${v / 100})}`).join("");
  return { name, css: `@keyframes ${name}{${frames}}`, ms, rises: Boolean(motion.fromY) };
}

/** The sample line in a look, a word per `tick`, for the style previews. Put it inside a positioned 9:16 box. */
export function CaptionPreview({ look, style, tick, className }: { look: CaptionLook; style: ReelStyle; tick: number; className?: string }) {
  const per = Math.max(1, look.words);
  const i = tick % SAMPLE.length;
  const from = Math.floor(i / per) * per;
  const words = SAMPLE.slice(from, from + per);
  const keywords = new Set(words.map((_, k) => k).filter((k) => KEYWORDS.has(from + k)));
  return <CaptionLine look={look} style={style} words={words} active={i - from} keywords={keywords} lineKey={from} tick={tick} className={className} />;
}

/**
 * One caption line drawn in CSS over a 9:16 frame, `active` being the word that's being said: a stand-in for what
 * libass draws in the render, from the same numbers (packages/core/src/captions.ts): size, position, line width and
 * line breaks, the word-by-word animations, the boxes, stroke and shadow. Sizes are in container units, so it scales
 * with the frame. `lineKey` changes when a new line starts (it fades in), `tick` when the spoken word changes (it
 * animates). Put it inside a positioned 9:16 box.
 */
export function CaptionLine({
  look,
  style,
  words,
  active,
  keywords,
  lineKey,
  tick,
  className,
  onWord,
  selected = null,
  onRows,
}: {
  look: CaptionLook;
  style: ReelStyle;
  words: string[];
  active: number;
  keywords: Set<number>;
  lineKey: string | number;
  tick: string | number;
  className?: string;
  /** Makes the words clickable (the editor: click a word on the video to edit it). */
  onWord?: (k: number) => void;
  /** The word being edited, outlined. */
  selected?: number | null;
  /** Told how many lines the caption breaks into (1 or 2). */
  onRows?: (rows: number) => void;
}) {
  const em = CAPTION_FONT_EM[look.font];
  const stroke = CAPTION_STROKES[style];
  // ASS sizes are shares of sqrt(width × height): for 9:16 that's 1.333 widths, so 1 cqw of width is 0.75% of it.
  const outlineEm = (look.strokeWidth ?? (look.fill === "hollow" ? 0.045 : stroke.outline)) / em;
  const shadowEm = stroke.shadow / em;
  const bar = look.background === "bar";
  const weight = weightOf(look.font, look.weight);
  const boldFill = look.fill === "bold" && weight !== null;
  const revealing = REVEALING_ANIMATIONS.includes(look.animation);

  // Line breaks, measured once the text has its font and size: each word at its size (key words bigger, when they
  // are), in the heavier weight when the spoken word turns bold (the widest it gets).
  const frame = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<{ breakAt: number | null; scale: number }>({ breakAt: null, scale: 1 });
  const shown = words.map((w) => (look.casing === "upper" ? w.toUpperCase() : look.casing === "lower" ? w.toLowerCase() : w));
  const key = `${shown.join(" ")}|${look.font}|${look.weight}|${look.size}|${bar}|${look.keyScale}|${[...keywords].join(",")}|${boldFill}`;
  useLayoutEffect(() => {
    const measure = () => {
      if (!frame.current || !text.current) return;
      canvas ??= document.createElement("canvas").getContext("2d");
      if (!canvas) return;
      // At the look's own size (not the shrunk one on screen), so shrinking doesn't feed back into the measurement.
      const css = getComputedStyle(text.current);
      const px = (look.size * 133.33 * em * frame.current.clientWidth) / 100;
      canvas.font = `${css.fontStyle} ${boldFill ? 800 : css.fontWeight} ${px.toFixed(2)}px ${css.fontFamily}`;
      const widths = shown.map((w, k) => canvas!.measureText(w).width * (keywords.has(k) ? look.keyScale : 1));
      const next = fitLines(widths, canvas.measureText(" ").width, frame.current.clientWidth * captionWidth(9, 16, bar));
      setFit((f) => (f.breakAt === next.breakAt && Math.abs(f.scale - next.scale) < 0.005 ? f : next));
      onRows?.(next.breakAt === null ? 1 : 2);
    };
    measure();
    document.fonts?.ready.then(measure);
    const resize = new ResizeObserver(measure);
    if (frame.current) resize.observe(frame.current);
    return () => resize.disconnect();
    // `key` covers everything the measurement reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Around and under the letters: the customer's stroke and shadow when they chose them, else the style's.
  const strokeColor = look.strokeColor ?? (look.fill === "hollow" ? look.color : "#000000");
  const shadows: string[] = [];
  if (look.stroke === "soft") shadows.push(`0 0 ${0.14 / em}em ${rgba(look.strokeColor ?? "#000000", 0.8)}`);
  if (look.shadowKind === "hard") shadows.push(`0 ${SHADOW.offset / em}em 0 rgb(0 0 0 / 0.9)`);
  else if (look.shadowKind === "soft") shadows.push(`0 ${SHADOW.offset / em}em ${SHADOW.blur / em}em rgb(0 0 0 / 0.75)`);
  else if (!look.shadowKind) {
    if (look.stroke === "soft") shadows.push(`0 ${shadowEm}em ${0.1 / em}em rgb(0 0 0 / 0.55)`);
    else if (look.hardShadow) shadows.push(`${shadowEm}em ${shadowEm}em 0 ${look.keyword}`);
    else if (shadowEm > 0) shadows.push(`0 ${shadowEm}em 0 rgb(0 0 0 / ${((255 - stroke.back) / 255).toFixed(2)})`);
  }
  if (look.glow) shadows.push(`0 0 ${0.12 / em}em ${look.accent}`, `0 0 ${0.3 / em}em ${look.accent}`);

  const textStyle: CSSProperties = {
    fontSize: `${(look.size * 133.33 * em * fit.scale).toFixed(2)}cqw`,
    fontWeight: weight ? WEIGHT[weight] : 400,
    lineHeight: 1.12,
    color: look.color,
    whiteSpace: "nowrap",
    textShadow: shadows.join(", ") || undefined,
    WebkitTextStroke: (look.stroke === "hard" || look.fill === "hollow") && outlineEm > 0 ? `${(2 * outlineEm).toFixed(3)}em ${strokeColor}` : undefined,
    paintOrder: "stroke fill",
  };
  // Top and middle hang the lines from their height; bottom stands them on it.
  const place = captionY(9, 16, look);
  const position: CSSProperties = look.position === "bottom" ? { bottom: `${((1 - place) * 100).toFixed(1)}%` } : { top: `${(place * 100).toFixed(1)}%` };

  // The spoken word's animation, as keyframes in the style tag below.
  const motion = active >= 0 && !revealing ? motionKeyframes(look, keywords.has(active)) : null;

  const word = (k: number) => {
    const isKey = keywords.has(k);
    const said = k === active;
    const keyColor = isKey && look.keyword !== look.color ? look.keyword : null;
    let color = said ? (keyColor ?? look.accent) : (keyColor ?? look.color);
    if (look.fill === "karaoke") color = k <= active ? (keyColor ?? look.accent) : look.color;
    const css: CSSProperties = { color };
    if (look.keyScale !== 1 && isKey) css.fontSize = `${look.keyScale}em`;
    if (look.fill === "dim" && !said) css.opacity = 0.6;
    if (look.fill === "hollow") css.color = said ? look.accent : "transparent";
    if (boldFill && said) css.fontWeight = 800;
    // On a box behind the spoken word, the word reads in the box's own text colour, printed flat.
    if (look.background === "band" && said) Object.assign(css, { color: look.accent, background: look.backgroundColor, padding: "0 0.12em", borderRadius: "0.14em", WebkitTextStroke: "0", textShadow: "none" });
    if (said && motion) Object.assign(css, { display: "inline-block", animation: `${motion.name} ${motion.ms}ms ease-out`, transformOrigin: motion.rises ? "50% 80%" : "50% 50%" });
    // Words not said yet keep their place, unseen.
    if (revealing && k > active) css.opacity = 0;
    if (look.animation === "reveal" && said) Object.assign(css, { display: "inline-block", animation: "reel-reveal 80ms ease-out" });
    const letters =
      look.animation === "typewriter" && said
        ? [...shown[k]].map((ch, i) => (
            <span key={i} style={{ opacity: 0, animation: `reel-type 1ms linear ${Math.round(i * TYPEWRITER_LETTER * 1000)}ms forwards` }}>
              {ch}
            </span>
          ))
        : shown[k];
    // The space sits outside the word, so an animated (inline-block) word keeps it.
    return (
      <Fragment key={`${lineKey}-${k}`}>
        {k > 0 && k !== fit.breakAt ? " " : ""}
        {k > 0 && k === fit.breakAt && <br />}
        {onWord ? (
          <span
            key={said ? tick : "still"}
            role="button"
            tabIndex={0}
            aria-label={`Edit “${words[k]}”`}
            onClick={(e) => {
              e.stopPropagation();
              onWord(k);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onWord(k);
              }
            }}
            className={cn("pointer-events-auto cursor-text rounded-[0.12em] outline-offset-[0.06em] hover:outline hover:outline-[0.06em] hover:outline-white/80 focus-visible:outline focus-visible:outline-[0.06em] focus-visible:outline-white", k === selected && "outline outline-[0.08em] outline-white")}
            style={css}
          >
            {letters}
          </span>
        ) : (
          <span key={said ? tick : "still"} style={css}>
            {letters}
          </span>
        )}
      </Fragment>
    );
  };

  // The line comes in: a fade (longer for "fade"), none for the animations that bring words in one by one.
  const lineFade = look.animation === "none" || revealing ? undefined : `reel-fade ${look.animation === "fade" ? 0.12 : 0.06}s ease-out`;
  return (
    <span ref={frame} className={cn("pointer-events-none absolute inset-x-0 flex justify-center [container-type:inline-size]", className)} style={{ ...position, height: 0 }} aria-hidden={onWord ? undefined : true}>
      <style>{`@keyframes reel-pop{from{transform:scale(1.14)}to{transform:scale(1)}}@keyframes reel-fade{from{opacity:0}to{opacity:1}}@keyframes reel-reveal{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}@keyframes reel-type{to{opacity:1}}${motion?.css ?? ""}`}</style>
      <span
        ref={text}
        key={lineFade ? lineKey : "line"}
        className={cn("absolute text-center", look.position === "bottom" ? "bottom-0" : "top-0", CAPTION_FONT_CLASS[look.font])}
        style={{ ...textStyle, ...(bar ? { width: "90%" } : {}), animation: lineFade }}
      >
        {/* One box around the whole caption, or a bar across the frame with an accent stripe, as the render draws them. */}
        <span
          className={cn(look.background === "box" && "inline-block")}
          style={
            look.background === "box"
              ? { background: rgba(look.backgroundColor, (255 - boxAlpha(look.backgroundColor)) / 255), padding: "0.14em 0.28em", borderRadius: "0.22em" }
              : bar
                ? { display: "block", background: rgba(look.backgroundColor, 0.88), padding: "0.2em 0.4em", borderRadius: "0.12em", borderLeft: `0.16em solid ${look.accent}` }
                : undefined
          }
        >
          {words.map((_, k) => word(k))}
        </span>
      </span>
    </span>
  );
}
