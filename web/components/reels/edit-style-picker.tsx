"use client";
import { Check, Music, Sparkles } from "lucide-react";
import { EDIT_STYLES, REEL_EDIT_STYLES, REEL_STRENGTHS, STRENGTH_LABEL, type ReelEditStyle, type ReelStrength } from "@launchreel/core/edit-styles";
import { EFFECTS } from "@launchreel/core/effects";
import { REEL_MUSIC } from "@launchreel/core/music-beds";
import { cn } from "@/lib/cn";
import { StyleFrame, useTick } from "./style-picker";

/**
 * Edit styles, each previewed on the sample frame with its captions, grade and overlays, and what else it brings (music,
 * an effect on the cuts); then how strong the edit is. Picking a style sets the form's other choices as a starting point.
 */
export function EditStylePicker({ value, strength, onChange, onStrength }: { value: ReelEditStyle; strength: ReelStrength; onChange: (style: ReelEditStyle) => void; onStrength: (strength: ReelStrength) => void }) {
  const tick = useTick();
  return (
    <div className="space-y-3">
      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-6" role="radiogroup" aria-label="Edit style">
        {REEL_EDIT_STYLES.map((id) => {
          const spec = EDIT_STYLES[id];
          const selected = value === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${spec.label}: ${spec.hint}`}
              title={spec.hint}
              onClick={() => onChange(id)}
              className={cn("relative flex w-[120px] shrink-0 snap-start flex-col overflow-hidden rounded-lg border text-left transition-colors sm:w-auto", selected ? "border-gray-1000 ring-1 ring-gray-1000" : "border-gray-alpha-400 hover:border-gray-alpha-500")}
            >
              <StyleFrame style={spec.options.style} changes={spec.options.look} fonts={spec.options.fonts} picture={spec.picture} tick={tick} />
              <span className="block border-t border-gray-alpha-400 bg-background-100 px-2 py-1.5">
                <span className="block text-[13px] font-medium text-gray-1000">{spec.label}</span>
                <span className="mt-0.5 flex min-h-4 flex-wrap gap-x-2 text-[11px] text-gray-900">
                  {spec.music && (
                    <span className="flex items-center gap-0.5">
                      <Music className="size-3" />
                      {REEL_MUSIC[spec.music.track].label}
                    </span>
                  )}
                  {spec.cutEffect && (
                    <span className="flex items-center gap-0.5">
                      <Sparkles className="size-3" />
                      {EFFECTS[spec.cutEffect].label}
                    </span>
                  )}
                </span>
              </span>
              {selected && (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-white text-black">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-[13px] text-gray-900">
        <span className="font-medium text-gray-1000">{EDIT_STYLES[value].label}:</span> {EDIT_STYLES[value].hint}. Change anything below, or later in the editor.
      </p>
      <div>
        <div className="flex h-10 w-full items-center gap-0.5 rounded-md border border-gray-alpha-400 bg-background-100 p-1 sm:inline-flex sm:w-auto" role="radiogroup" aria-label="Strength">
          {REEL_STRENGTHS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={strength === s} onClick={() => onStrength(s)} className={cn("h-full flex-1 rounded px-3 text-sm transition-colors sm:flex-none sm:px-4", strength === s ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000")}>
              {STRENGTH_LABEL[s].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-gray-900">{STRENGTH_LABEL[strength].hint}.</p>
      </div>
    </div>
  );
}
