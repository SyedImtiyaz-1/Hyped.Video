"use client";
import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { CAPTION_FONTS, resolveLook, type CaptionAnimation, type CaptionPosition, type ReelLookChanges, type ReelStyle } from "@launchreel/core/captions";
import type { ReelFont } from "@launchreel/core/reel";
import { cn } from "@/lib/cn";
import { CAPTION_FONT_CLASS, CAPTION_FONT_LABEL } from "./caption-fonts";
import { StyleFrame, useTick } from "./style-picker";

const TEXT_COLORS = ["#FFFFFF", "#FFF4D6", "#FFE135", "#C6FF3D", "#5CE1E6", "#FF4FD8"];
const HIGHLIGHTS = ["#FFD60A", "#3BF26B", "#C6FF3D", "#FF8A00", "#FF4FD8", "#4C9BFF", "#F2462E"];
const SIZES: [string, number][] = [
  ["S", 0.85],
  ["M", 1],
  ["L", 1.2],
  ["XL", 1.4],
];
const WORDS = [1, 2, 3, 4, 6];
const ANIMATIONS: [string, CaptionAnimation][] = [
  ["Pop", "pop"],
  ["Fade", "fade"],
  ["None", "none"],
];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[13px] text-gray-900">{label}</p>
      {children}
    </div>
  );
}

/** A row of options as a radio group, like the language switch. */
function Segmented<T extends string | number>({ label, options, value, onChange }: { label: string; options: [string, T][]; value: T; onChange: (value: T) => void }) {
  return (
    <div className="flex h-9 w-full items-center gap-0.5 rounded-md border border-gray-alpha-400 bg-background-100 p-0.5" role="radiogroup" aria-label={label}>
      {options.map(([name, option]) => (
        <button
          key={name}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={cn("h-full flex-1 rounded px-1.5 text-[13px] transition-colors", value === option ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000")}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

/** Colour swatches, then any colour from the system picker. */
function Swatches({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (hex: string) => void }) {
  const custom = !options.includes(value.toUpperCase());
  return (
    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={label}>
      {options.map((hex) => (
        <button
          key={hex}
          type="button"
          role="radio"
          aria-checked={value.toUpperCase() === hex}
          aria-label={hex}
          onClick={() => onChange(hex)}
          className={cn("size-6 rounded-full border border-gray-alpha-500", value.toUpperCase() === hex && "ring-2 ring-gray-1000 ring-offset-2 ring-offset-background-100")}
          style={{ background: hex }}
        />
      ))}
      <label className={cn("relative size-6 cursor-pointer overflow-hidden rounded-full border border-dashed border-gray-alpha-600", custom && "ring-2 ring-gray-1000 ring-offset-2 ring-offset-background-100")} title="Any colour" style={custom ? { background: value } : undefined}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="absolute inset-0 size-full cursor-pointer opacity-0" aria-label={`${label}: any colour`} />
        {!custom && <span className="flex size-full items-center justify-center text-[13px] leading-none text-gray-900">+</span>}
      </label>
    </div>
  );
}

/**
 * Customizing a caption style: a live preview of the reel's captions on the sample frame, then font, colours, size,
 * position, words on screen, animation and capitals. Everything left alone stays the style's own.
 */
export function LookEditor({ style, changes, onChange, fonts }: { style: ReelStyle; changes: ReelLookChanges; onChange: (changes: ReelLookChanges) => void; fonts: ReelFont[] }) {
  const tick = useTick();
  const look = resolveLook(style, changes);
  // A change back to the style's own value is dropped, so "Reset" only shows when something differs.
  const set = (patch: ReelLookChanges) => onChange(Object.fromEntries(Object.entries({ ...changes, ...patch }).filter(([, v]) => v !== undefined)) as ReelLookChanges);
  const highlight = look.background === "band" ? look.backgroundColor : look.accent;
  // Captions at the top would meet "Behind you"'s big words.
  const positions: [string, CaptionPosition][] = style === "behind" ? [["Middle", "middle"], ["Bottom", "bottom"]] : [["Top", "top"], ["Middle", "middle"], ["Bottom", "bottom"]];
  return (
    <div className="grid gap-4 rounded-lg border border-gray-alpha-400 p-3 sm:grid-cols-[176px_minmax(0,1fr)] sm:gap-5 sm:p-4">
      <div>
        <StyleFrame style={style} changes={changes} fonts={fonts} tick={tick} className="mx-auto w-[150px] rounded-md sm:w-full" />
        <p className="mt-2 text-center text-xs text-gray-900">Live preview</p>
      </div>
      <div className="min-w-0 space-y-4">
        <Field label={style === "behind" ? "Caption font" : "Font"}>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Font">
            {CAPTION_FONTS.map((font) => (
              <button
                key={font}
                type="button"
                role="radio"
                aria-checked={look.font === font}
                onClick={() => set({ font })}
                className={cn(
                  "h-8 rounded-md border px-2.5 text-[15px] leading-none transition-colors",
                  look.font === font ? "border-gray-1000 bg-gray-alpha-200 text-gray-1000" : "border-gray-alpha-400 text-gray-1000 hover:border-gray-alpha-500",
                  font === "inter" ? "font-bold" : CAPTION_FONT_CLASS[font],
                )}
              >
                {CAPTION_FONT_LABEL[font]}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Text colour">
            <Swatches label="Text colour" value={look.color} options={TEXT_COLORS} onChange={(color) => set({ color })} />
          </Field>
          <Field label={style === "highlight" ? "Marker colour" : "Highlight colour"}>
            <Swatches label="Highlight colour" value={highlight} options={HIGHLIGHTS} onChange={(accent) => set({ accent })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Size">
            <Segmented label="Size" options={SIZES} value={changes.size ?? 1} onChange={(size) => set({ size: size === 1 ? undefined : size })} />
          </Field>
          <Field label="Position">
            <Segmented label="Position" options={positions} value={look.position === "top" && style === "behind" ? "middle" : look.position} onChange={(position) => set({ position })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Words on screen">
            <Segmented label="Words on screen" options={WORDS.map((n) => [String(n), n] as [string, number])} value={look.words} onChange={(words) => set({ words })} />
          </Field>
          <Field label="Animation">
            <Segmented label="Animation" options={ANIMATIONS} value={look.animation} onChange={(animation) => set({ animation })} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-1000">
            <input type="checkbox" checked={look.casing === "upper"} onChange={(e) => set({ caps: e.target.checked })} className="size-4 accent-[var(--ds-gray-1000)]" />
            All capitals
          </label>
          {Object.keys(changes).length > 0 && (
            <button type="button" onClick={() => onChange({})} className="flex items-center gap-1.5 text-[13px] text-gray-900 hover:text-gray-1000">
              <RotateCcw className="size-3.5" />
              Reset to the style&apos;s look
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
