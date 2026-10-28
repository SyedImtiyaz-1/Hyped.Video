"use client";
// The editor's picture, as the render makes it: the moves (punch-ins, pull-ins, shakes) as a transform on the video, the
// colour filter, colour split and blur as filters on it, then the layers over it in the render's order: VHS lines and
// grain, flashes to white or black, film grain, the vignette, letterbox bars. The numbers are the render's
// (packages/core/src/effects.ts, picture.ts, timeline.ts).
import { useEffect, useId, useRef, type CSSProperties } from "react";
import type { EffectFrame } from "@launchreel/core/effects";
import { GRAIN, gradeMatrix, LETTERBOX, VHS, vignetteCss, type ReelPicture } from "@launchreel/core/picture";
import { viewport } from "@launchreel/core/timeline";

/** The video's transform for a zoom, moved by (dx, dy), aimed at `aimY`: the part in view fills the frame. */
export function viewTransform(zoom: number, dx: number, dy: number, aimY: number): CSSProperties {
  const v = viewport(zoom, dx, dy, aimY);
  if (v.size >= 0.9999) return {};
  return { transform: `scale(${(1 / v.size).toFixed(4)}) translate(${(-v.x * 100).toFixed(3)}%, ${(-v.y * 100).toFixed(3)}%)`, transformOrigin: "0 0" };
}

/**
 * The filters on the video: an SVG filter for the colour matrix and the red/blue split (in sRGB, like ffmpeg's
 * colorchannelmixer and rgbashift), then CSS blur. `width` is the frame's width in CSS pixels: blur and split are shares
 * of it. Returns the CSS `filter` and the SVG to put on the page.
 */
export function useVideoFilter(picture: ReelPicture, fx: EffectFrame, width: number) {
  const id = `reel-look-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;
  const grade = gradeMatrix(picture.filter, picture.strength);
  const split = Math.round(((fx.rgb + (picture.filter === "vhs" ? VHS.rgb * picture.strength : 0)) * width) * 10) / 10;
  const blur = fx.blur * width;
  const svg =
    grade || split > 0 ? (
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          {grade && <feColorMatrix type="matrix" values={`${grade.slice(0, 3).join(" ")} 0 ${grade[3]} ${grade.slice(4, 7).join(" ")} 0 ${grade[7]} ${grade.slice(8, 11).join(" ")} 0 ${grade[11]} 0 0 0 1 0`} result="graded" />}
          {split > 0 && (
            <>
              <feColorMatrix in={grade ? "graded" : "SourceGraphic"} type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r" />
              <feOffset in="r" dx={-split} result="r2" />
              <feColorMatrix in={grade ? "graded" : "SourceGraphic"} type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g" />
              <feColorMatrix in={grade ? "graded" : "SourceGraphic"} type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b" />
              <feOffset in="b" dx={split} result="b2" />
              <feBlend in="r2" in2="g" mode="screen" result="rg" />
              <feBlend in="rg" in2="b2" mode="screen" />
            </>
          )}
        </filter>
      </svg>
    ) : null;
  const filter = [svg ? `url(#${id})` : "", blur >= 0.2 ? `blur(${blur.toFixed(2)}px)` : ""].filter(Boolean).join(" ");
  return { filter: filter || undefined, svg };
}

/** Grain: random grey noise blended over the picture, redrawn every frame while `animate` (still otherwise). */
function Grain({ opacity, animate, className }: { opacity: number; animate: boolean; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const on = opacity > 0;
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !on) return;
    const image = ctx.createImageData(c.width, c.height);
    let frame = 0;
    const draw = () => {
      for (let i = 0; i < image.data.length; i += 4) {
        const v = Math.random() * 255;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
      if (animate) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [on, animate]);
  if (opacity <= 0) return null;
  return <canvas ref={canvas} width={160} height={284} className={className} style={{ opacity, mixBlendMode: "overlay", imageRendering: "pixelated" }} aria-hidden />;
}

/** The layers over the video, in the render's order; grain moves while `animate` (the video plays). */
export function PictureLayers({ picture, fx, animate = false }: { picture: ReelPicture; fx: EffectFrame; animate?: boolean }) {
  const vhs = picture.filter === "vhs" ? picture.strength : 0;
  const cover = "pointer-events-none absolute inset-0 size-full";
  return (
    <>
      {vhs > 0 && <span className={cover} style={{ backgroundImage: `repeating-linear-gradient(to bottom, rgb(0 0 0 / ${(VHS.lineAlpha * vhs).toFixed(2)}) 0 1px, transparent 1px ${Math.max(2, VHS.lines * 300).toFixed(1)}px)` }} aria-hidden />}
      <Grain opacity={Math.min(0.3, (VHS.noise * vhs + fx.noise) * 0.22)} animate={animate} className={cover} />
      {fx.white > 0 && <span className={cover} style={{ background: "#fff", opacity: fx.white }} aria-hidden />}
      {fx.black > 0 && <span className={cover} style={{ background: "#000", opacity: fx.black }} aria-hidden />}
      {picture.grain && <Grain opacity={GRAIN.opacity} animate={animate} className={cover} />}
      {picture.vignette && <span className={cover} style={{ background: vignetteCss() }} aria-hidden />}
      {picture.letterbox && (
        <>
          <span className="pointer-events-none absolute inset-x-0 top-0 bg-black" style={{ height: `${LETTERBOX * 100}%` }} aria-hidden />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black" style={{ height: `${LETTERBOX * 100}%` }} aria-hidden />
        </>
      )}
    </>
  );
}
