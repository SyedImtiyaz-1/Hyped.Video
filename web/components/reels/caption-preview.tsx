"use client";
import { Fragment, type CSSProperties } from "react";
import { CAPTION_FONT_EM, CAPTION_STROKES, type CaptionLook, type ReelStyle } from "@launchreel/core/captions";
import { cn } from "@/lib/cn";
import { CAPTION_FONT_CLASS } from "./caption-fonts";

// A sample line, said a word at a time, with two key words. Twelve words split evenly into lines of 1, 2, 3, 4 or 6.
const SAMPLE = ["Here's", "how", "I", "doubled", "my", "sales", "in", "30", "days", "without", "any", "ads"];
const KEYWORDS = new Set([3, 7]);
const WEIGHT = { black: 900, extrabold: 800, semibold: 600, medium: 500 } as const;

/** "#RRGGBB" at an opacity, as CSS. */
const rgba = (hex: string, opacity: number) => `rgb(${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)} / ${opacity})`;

/**
 * A caption look drawn in CSS over a 9:16 frame, saying the sample line a word per `tick`: a stand-in for what libass
 * draws in the render (runner/src/reel.ts), from the same numbers. Sizes are in container units, so it scales with
 * the frame. Put it inside a positioned 9:16 box.
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
  const fontSize = `${(look.size * 133.33 * em).toFixed(2)}cqw`;
  const outlineEm = (look.fill === "hollow" ? 0.045 : stroke.outline) / em;
  const shadowEm = stroke.shadow / em;

  const shadows: string[] = [];
  if (look.stroke === "soft") shadows.push(`0 0 ${0.14 / em}em rgb(0 0 0 / 0.8)`, `0 ${shadowEm}em ${0.1 / em}em rgb(0 0 0 / 0.55)`);
  else if (look.hardShadow) shadows.push(`${shadowEm}em ${shadowEm}em 0 ${look.keyword}`);
  else if (shadowEm > 0) shadows.push(`0 ${shadowEm}em 0 rgb(0 0 0 / ${((255 - stroke.back) / 255).toFixed(2)})`);
  if (look.glow) shadows.push(`0 0 ${0.12 / em}em ${look.accent}`, `0 0 ${0.3 / em}em ${look.accent}`);

  const text: CSSProperties = {
    fontSize,
    fontWeight: look.font === "inter" ? WEIGHT[look.weight] : 400,
    lineHeight: 1.15,
    color: look.color,
    textTransform: look.casing === "upper" ? "uppercase" : look.casing === "lower" ? "lowercase" : "none",
    textShadow: shadows.join(", ") || undefined,
    WebkitTextStroke: look.stroke === "hard" || look.fill === "hollow" ? `${(2 * outlineEm).toFixed(3)}em ${look.fill === "hollow" ? look.color : "#000"}` : undefined,
    paintOrder: "stroke fill",
  };
  const position: CSSProperties = look.position === "top" ? { top: "22%" } : look.position === "middle" ? { top: "50%" } : { bottom: "36%" };

  return (
    <span className={cn("pointer-events-none absolute inset-x-0 flex justify-center [container-type:inline-size]", className)} style={{ ...position, height: 0 }} aria-hidden>
      <style>{`@keyframes reel-pop{from{transform:scale(1.14)}to{transform:scale(1)}}`}</style>
      <span className={cn("absolute w-[78%] text-center", look.position === "bottom" ? "bottom-0" : "top-0", CAPTION_FONT_CLASS[look.font])} style={{ ...text, ...(look.background === "bar" ? { width: "90%" } : {}) }}>
        <span
          className={cn(look.background !== "none" && look.background !== "band" && "inline [box-decoration-break:clone]")}
          style={
            look.background === "box"
              ? { background: rgba(look.backgroundColor, 0.78), padding: "0.12em 0.3em", borderRadius: "0.22em" }
              : look.background === "bar"
                ? { display: "block", background: rgba(look.backgroundColor, 0.88), padding: "0.22em 0.4em", borderRadius: "0.12em", borderLeft: `0.16em solid ${look.accent}` }
                : undefined
          }
        >
          {words.map((word, k) => {
            const key = KEYWORDS.has(from + k);
            const said = k === active;
            const keyColor = key && look.keyword !== look.color ? look.keyword : null;
            let color = said ? (keyColor ?? look.accent) : (keyColor ?? look.color);
            if (look.fill === "karaoke") color = k <= active ? (keyColor ?? look.accent) : look.color;
            const style: CSSProperties = { color };
            if (look.fill === "dim" && !said) style.opacity = 0.6;
            if (look.fill === "hollow") style.color = said ? look.accent : "transparent";
            if (look.background === "band" && said) Object.assign(style, { background: look.backgroundColor, padding: "0 0.12em", borderRadius: "0.14em", WebkitTextStroke: "0", textShadow: "none" });
            if (said && look.animation === "pop" && look.background !== "band") Object.assign(style, { display: "inline-block", animation: "reel-pop 0.11s ease-out" });
            // The space sits outside the word, so a popping (inline-block) word keeps it.
            return (
              <Fragment key={`${from}-${k}`}>
                {k > 0 ? " " : ""}
                <span key={said ? tick : "still"} style={style}>
                  {word}
                </span>
              </Fragment>
            );
          })}
        </span>
      </span>
    </span>
  );
}
