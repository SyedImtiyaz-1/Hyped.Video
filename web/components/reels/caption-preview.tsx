"use client";
import { Fragment, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { CAPTION_FONT_EM, CAPTION_STROKES, captionPlace, captionWidth, type CaptionLook, type ReelStyle } from "@launchreel/core/captions";
import { cn } from "@/lib/cn";
import { CAPTION_FONT_CLASS } from "./caption-fonts";

// A sample line, said a word at a time, with two key words. Twelve words split evenly into lines of 1, 2, 3, 4 or 6.
const SAMPLE = ["Here's", "how", "I", "doubled", "my", "sales", "in", "30", "days", "without", "any", "ads"];
const KEYWORDS = new Set([3, 7]);
const WEIGHT = { black: 900, extrabold: 800, semibold: 600, medium: 500 } as const;

/** "#RRGGBB" at an opacity, as CSS. */
const rgba = (hex: string, opacity: number) => `rgb(${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)} / ${opacity})`;

let canvas: CanvasRenderingContext2D | null = null;

/**
 * Where a caption breaks and how far it shrinks, the way the render does (lineBreak in runner/src/reel.ts): one line if
 * it fits, else the two most even lines, smaller if even those are too wide. Measured in the real font.
 */
function fitLines(words: string[], font: string, max: number): { breakAt: number | null; scale: number } {
  canvas ??= document.createElement("canvas").getContext("2d");
  if (!canvas || !words.length) return { breakAt: null, scale: 1 };
  canvas.font = font;
  const width = (ws: string[]) => canvas!.measureText(ws.join(" ")).width;
  const all = width(words);
  if (words.length < 2 || all <= max) return { breakAt: null, scale: Math.min(1, max / all) };
  let best = { breakAt: 1, widest: Infinity };
  for (let k = 1; k < words.length; k++) {
    const widest = Math.max(width(words.slice(0, k)), width(words.slice(k)));
    if (widest < best.widest) best = { breakAt: k, widest };
  }
  return { breakAt: best.breakAt, scale: Math.min(1, max / best.widest) };
}

/**
 * A caption look drawn in CSS over a 9:16 frame, saying the sample line a word per `tick`: a stand-in for what libass
 * draws in the render, from the same numbers (packages/core/src/captions.ts): size, position, line width and line
 * breaks. Sizes are in container units, so it scales with the frame. Put it inside a positioned 9:16 box.
 */
export function CaptionPreview({ look, style, tick, className }: { look: CaptionLook; style: ReelStyle; tick: number; className?: string }) {
  const per = Math.max(1, look.words);
  const i = tick % SAMPLE.length;
  const from = Math.floor(i / per) * per;
  const words = SAMPLE.slice(from, from + per);
  const active = i - from;
  const em = CAPTION_FONT_EM[look.font];
  const stroke = CAPTION_STROKES[style];
  // ASS sizes are shares of sqrt(width × height): for 9:16 that's 1.333 widths, so 1 cqw of width is 0.75% of it.
  const outlineEm = (look.fill === "hollow" ? 0.045 : stroke.outline) / em;
  const shadowEm = stroke.shadow / em;
  const bar = look.background === "bar";

  // Line breaks, measured once the text has its font and size.
  const frame = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<{ breakAt: number | null; scale: number }>({ breakAt: null, scale: 1 });
  const shown = words.map((w) => (look.casing === "upper" ? w.toUpperCase() : look.casing === "lower" ? w.toLowerCase() : w));
  const key = `${shown.join(" ")}|${look.font}|${look.weight}|${look.size}|${bar}`;
  useLayoutEffect(() => {
    const measure = () => {
      if (!frame.current || !text.current) return;
      // At the look's own size (not the shrunk one on screen), so shrinking doesn't feed back into the measurement.
      const css = getComputedStyle(text.current);
      const px = (look.size * 133.33 * em * frame.current.clientWidth) / 100;
      const next = fitLines(shown, `${css.fontStyle} ${css.fontWeight} ${px.toFixed(2)}px ${css.fontFamily}`, frame.current.clientWidth * captionWidth(9, 16, bar));
      setFit((f) => (f.breakAt === next.breakAt && Math.abs(f.scale - next.scale) < 0.005 ? f : next));
    };
    measure();
    document.fonts?.ready.then(measure);
    const resize = new ResizeObserver(measure);
    if (frame.current) resize.observe(frame.current);
    return () => resize.disconnect();
    // `key` covers everything the measurement reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const shadows: string[] = [];
  if (look.stroke === "soft") shadows.push(`0 0 ${0.14 / em}em rgb(0 0 0 / 0.8)`, `0 ${shadowEm}em ${0.1 / em}em rgb(0 0 0 / 0.55)`);
  else if (look.hardShadow) shadows.push(`${shadowEm}em ${shadowEm}em 0 ${look.keyword}`);
  else if (shadowEm > 0) shadows.push(`0 ${shadowEm}em 0 rgb(0 0 0 / ${((255 - stroke.back) / 255).toFixed(2)})`);
  if (look.glow) shadows.push(`0 0 ${0.12 / em}em ${look.accent}`, `0 0 ${0.3 / em}em ${look.accent}`);

  const textStyle: CSSProperties = {
    fontSize: `${(look.size * 133.33 * em * fit.scale).toFixed(2)}cqw`,
    fontWeight: look.font === "inter" ? WEIGHT[look.weight] : 400,
    lineHeight: 1.12,
    color: look.color,
    whiteSpace: "nowrap",
    textShadow: shadows.join(", ") || undefined,
    WebkitTextStroke: look.stroke === "hard" || look.fill === "hollow" ? `${(2 * outlineEm).toFixed(3)}em ${look.fill === "hollow" ? look.color : "#000"}` : undefined,
    paintOrder: "stroke fill",
  };
  // Top and middle hang the lines from their height; bottom stands them on it.
  const place = captionPlace(9, 16, look.position);
  const position: CSSProperties = look.position === "bottom" ? { bottom: `${((1 - place) * 100).toFixed(1)}%` } : { top: `${(place * 100).toFixed(1)}%` };

  const word = (k: number) => {
    const isKey = KEYWORDS.has(from + k);
    const said = k === active;
    const keyColor = isKey && look.keyword !== look.color ? look.keyword : null;
    let color = said ? (keyColor ?? look.accent) : (keyColor ?? look.color);
    if (look.fill === "karaoke") color = k <= active ? (keyColor ?? look.accent) : look.color;
    const css: CSSProperties = { color };
    if (look.fill === "dim" && !said) css.opacity = 0.6;
    if (look.fill === "hollow") css.color = said ? look.accent : "transparent";
    if (look.background === "band" && said) Object.assign(css, { background: look.backgroundColor, padding: "0 0.12em", borderRadius: "0.14em", WebkitTextStroke: "0", textShadow: "none" });
    if (said && look.animation === "pop" && look.background !== "band") Object.assign(css, { display: "inline-block", animation: "reel-pop 0.11s ease-out" });
    // The space sits outside the word, so a popping (inline-block) word keeps it.
    return (
      <Fragment key={`${from}-${k}`}>
        {k > 0 && k !== fit.breakAt ? " " : ""}
        {k > 0 && k === fit.breakAt && <br />}
        <span key={said ? tick : "still"} style={css}>
          {shown[k]}
        </span>
      </Fragment>
    );
  };

  return (
    <span ref={frame} className={cn("pointer-events-none absolute inset-x-0 flex justify-center [container-type:inline-size]", className)} style={{ ...position, height: 0 }} aria-hidden>
      <style>{`@keyframes reel-pop{from{transform:scale(1.14)}to{transform:scale(1)}}@keyframes reel-fade{from{opacity:0}to{opacity:1}}`}</style>
      <span
        ref={text}
        key={look.animation === "none" ? "line" : from}
        className={cn("absolute text-center", look.position === "bottom" ? "bottom-0" : "top-0", CAPTION_FONT_CLASS[look.font])}
        style={{
          ...textStyle,
          ...(bar ? { width: "90%" } : {}),
          animation: look.animation === "none" ? undefined : `reel-fade ${look.animation === "fade" ? 0.12 : 0.06}s ease-out`,
        }}
      >
        {/* One box around the whole caption, or a bar across the frame with an accent stripe, as the render draws them. */}
        <span
          className={cn(look.background === "box" && "inline-block")}
          style={
            look.background === "box"
              ? { background: rgba(look.backgroundColor, 0.78), padding: "0.14em 0.28em", borderRadius: "0.22em" }
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
