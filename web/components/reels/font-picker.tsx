"use client";
import { Check } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { REEL_FONTS, REEL_MAX_FONTS, type ReelFont } from "@launchreel/core/reel";
import { cn } from "@/lib/cn";
import { abril, anton, archivo, dmSerif, kaushan, marker } from "./caption-fonts";
import { REEL_FONT_INFO } from "./labels";

// Each style's sample word as the render writes it (BIG_LOOKS in runner/src/reel.ts): face, casing and colour.
export const BIG_SAMPLES: Record<ReelFont, { word: string; className: string; style: CSSProperties }> = {
  classic: { word: "MONEY", className: "font-black tracking-tight", style: { color: "#FFFFFF" } },
  impact: { word: "MONEY", className: anton.className, style: { color: "#FFE135" } },
  editorial: { word: "Money", className: abril.className, style: { color: "#F2462E" } },
  elegant: { word: "money", className: dmSerif.className, style: { color: "#FFFFFF" } },
  script: { word: "Money", className: kaushan.className, style: { color: "#4C9BFF" } },
  marker: { word: "MONEY", className: marker.className, style: { color: "#FFFFFF" } },
  outline: { word: "MONEY", className: "font-black tracking-tight", style: { color: "transparent", WebkitTextStroke: "1.5px #FFFFFF" } },
  pop: { word: "MONEY", className: archivo.className, style: { color: "#C6FF3D", letterSpacing: "-0.02em" } },
};

/**
 * "Behind you"'s font styles for the big words, each previewing its word behind a speaker's head. One by default (a
 * radio group); with "Mix fonts" on, up to REEL_MAX_FONTS that the big words take turns in, numbered in that order.
 */
export function FontPicker({ value, onChange }: { value: ReelFont[]; onChange: (fonts: ReelFont[]) => void }) {
  const [mixing, setMixing] = useState(value.length > 1);
  const pick = (font: ReelFont) => {
    if (!mixing) onChange([font]);
    else if (value.includes(font)) onChange(value.length > 1 ? value.filter((f) => f !== font) : value);
    else if (value.length < REEL_MAX_FONTS) onChange([...value, font]);
  };
  const names = value.map((f) => REEL_FONT_INFO[f].label);
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" role={mixing ? "group" : "radiogroup"} aria-label="Font">
        {REEL_FONTS.map((font) => {
          const order = value.indexOf(font);
          const selected = order >= 0;
          const full = mixing && !selected && value.length >= REEL_MAX_FONTS;
          const sample = BIG_SAMPLES[font];
          return (
            <button
              key={font}
              type="button"
              role={mixing ? "checkbox" : "radio"}
              aria-checked={selected}
              aria-disabled={full || undefined}
              aria-label={`${REEL_FONT_INFO[font].label}: ${REEL_FONT_INFO[font].hint}`}
              onClick={() => pick(font)}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-lg border text-left transition-colors",
                selected ? "border-gray-1000 ring-1 ring-gray-1000" : "border-gray-alpha-400 hover:border-gray-alpha-500",
                full && "cursor-not-allowed opacity-50 hover:border-gray-alpha-400",
              )}
            >
              <span
                className="relative flex h-20 w-full items-center justify-center overflow-hidden sm:h-24"
                style={{
                  background: "radial-gradient(60% 55% at 50% 30%, #6b7aa1 0%, transparent 70%), linear-gradient(160deg, #273150, #10141f)",
                }}
                aria-hidden
              >
                <span
                  className={cn("-mt-3 text-[30px] leading-none sm:text-[34px]", sample.className)}
                  style={{
                    ...sample.style,
                    textShadow: "0 2px 10px rgb(0 0 0 / 0.5)",
                  }}
                >
                  {sample.word}
                </span>
                {/* The speaker's head, in front of the word, as the render puts their cut-out back on top. */}
                <span className="absolute left-1/2 top-[52%] aspect-square w-[22%] -translate-x-1/2 rounded-full bg-[#0b1020]" />
              </span>
              <span className="block border-t border-gray-alpha-400 bg-background-100 px-2.5 py-2 sm:px-3">
                <span className="block text-sm font-medium text-gray-1000">{REEL_FONT_INFO[font].label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-gray-900">{REEL_FONT_INFO[font].hint}</span>
              </span>
              {selected && (
                <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold tabular-nums text-black">
                  {mixing && value.length > 1 ? order + 1 : <Check className="size-3" strokeWidth={3} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={mixing}
          onChange={(e) => {
            setMixing(e.target.checked);
            if (!e.target.checked) onChange(value.slice(0, 1));
          }}
          className="mt-0.5 size-4 shrink-0 accent-[var(--ds-gray-1000)]"
        />
        <span className="min-w-0">
          <span className="block font-medium text-gray-1000">Mix fonts in one reel</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-gray-900">
            {!mixing
              ? `Pick up to ${REEL_MAX_FONTS} styles and the big words take turns.`
              : value.length > 1
                ? `The big words take turns: ${names.join(", then ")}. The hook title uses ${names[0]}.`
                : `Pick up to ${REEL_MAX_FONTS - 1} more. The big words take turns in the order you pick them.`}
          </span>
        </span>
      </label>
    </div>
  );
}
