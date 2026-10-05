"use client";
import { Check } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { REEL_STYLES, resolveLook, type ReelLookChanges, type ReelStyle } from "@launchreel/core/captions";
import { effectsAt } from "@launchreel/core/effects";
import { parsePicture, type ReelPicture } from "@launchreel/core/picture";
import type { ReelFont } from "@launchreel/core/reel";
import { cn } from "@/lib/cn";
import { CaptionPreview } from "./caption-preview";
import { BIG_SAMPLES } from "./font-picker";
import { REEL_STYLE_INFO } from "./labels";
import { PictureLayers, useVideoFilter } from "./picture-layers";

const STILL = effectsAt([], 0);

/** A word every `ms`, for the previews' sample line; still for people who ask for less motion. */
export function useTick(ms = 450) {
  const [tick, setTick] = useState(3);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(timer);
  }, [ms]);
  return tick;
}

/**
 * The sample frame (a creator talking to camera) with a style's captions on it, saying the sample line. "Behind you"
 * draws its big word on the frame and a cut-out of the speaker back over it, the way the render does. With `picture`,
 * the frame takes that grade and its overlays (an edit style's look), drawn by the editor's own filter code.
 */
export function StyleFrame({ style, changes, fonts = ["classic"], tick, className, picture }: { style: ReelStyle; changes?: ReelLookChanges; fonts?: ReelFont[]; tick: number; className?: string; picture?: Partial<ReelPicture> }) {
  const big = BIG_SAMPLES[fonts[Math.floor(tick / 4) % fonts.length]];
  const look = parsePicture({ filter: "none", strength: 1, grain: false, vignette: false, letterbox: false, ...picture });
  const { filter, svg } = useVideoFilter(look, STILL, 160);
  return (
    <span className={cn("relative block aspect-[9/16] w-full overflow-hidden bg-[#1a1d24] [container-type:inline-size]", className)}>
      {svg}
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static still, the same in every card */}
      <img src="/reels/sample-frame.jpg" alt="" className="absolute inset-0 size-full object-cover" style={{ filter }} loading="lazy" decoding="async" />
      {picture && <PictureLayers picture={look} fx={STILL} />}
      {style === "behind" && (
        <>
          <span className={cn("absolute inset-x-0 top-[21%] text-center leading-none", big.className)} style={{ ...big.style, fontSize: "19cqw", textShadow: "0 0.6cqw 2.5cqw rgb(0 0 0 / 0.45)" } as CSSProperties}>
            {big.word}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- the speaker cut out of the same still */}
          <img src="/reels/sample-person.webp" alt="" className="absolute inset-0 size-full object-cover" loading="lazy" decoding="async" />
        </>
      )}
      <CaptionPreview look={resolveLook(style, changes)} style={style} tick={tick} />
    </span>
  );
}

/** The caption styles, each previewing itself on the sample frame, as a radio group. */
export function StylePicker({ value, onChange, changes }: { value: ReelStyle; onChange: (style: ReelStyle) => void; changes?: ReelLookChanges }) {
  const tick = useTick();
  return (
    <div>
      {/* A row to swipe through on phones, a grid from tablets up. */}
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-6" role="radiogroup" aria-label="Caption style">
        {REEL_STYLES.map((style) => {
          const selected = value === style;
          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${REEL_STYLE_INFO[style].label}: ${REEL_STYLE_INFO[style].hint}`}
              title={REEL_STYLE_INFO[style].hint}
              onClick={() => onChange(style)}
              className={cn(
                "relative flex w-[108px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border text-left transition-colors sm:w-auto",
                selected ? "border-gray-1000 ring-1 ring-gray-1000" : "border-gray-alpha-400 hover:border-gray-alpha-500",
              )}
            >
              {/* The selected style shows the customer's changes; the others their own look. */}
              <StyleFrame style={style} changes={selected ? changes : undefined} tick={tick} />
              <span className="block border-t border-gray-alpha-400 bg-background-100 px-2 py-1.5 text-[13px] font-medium text-gray-1000">{REEL_STYLE_INFO[style].label}</span>
              {selected && (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-white text-black">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] text-gray-900">
        <span className="font-medium text-gray-1000">{REEL_STYLE_INFO[value].label}:</span> {REEL_STYLE_INFO[value].hint}.
      </p>
    </div>
  );
}
