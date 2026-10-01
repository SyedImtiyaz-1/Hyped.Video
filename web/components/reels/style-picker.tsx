"use client";
import { Check } from "lucide-react";
import { REEL_STYLES, type ReelStyle } from "@launchreel/core/reel";
import { cn } from "@/lib/cn";
import { REEL_STYLE_INFO } from "./labels";

// Stand-ins for what libass draws in the render (runner/src/reel.ts): the same colours, weights and casing.
const YELLOW = "#FFD60A";
const GREEN = "#3BF26B";
const outline = "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 3px 0 #000";

function Sample({ style }: { style: ReelStyle }) {
  if (style === "bold")
    return (
      <p className="text-[15px] font-black uppercase leading-tight tracking-tight text-white sm:text-base" style={{ textShadow: outline }}>
        <span style={{ color: GREEN }}>Stop</span>{" "}
        <span className="ml-1 inline-block scale-110" style={{ color: YELLOW }}>
          scrolling
        </span>
      </p>
    );
  if (style === "behind")
    return (
      <span className="relative block size-full overflow-hidden">
        <span className="absolute inset-x-0 top-[14%] text-center text-[28px] font-black uppercase leading-none tracking-tight text-white sm:text-[30px]">Money</span>
        {/* The speaker, drawn over the word: the render puts their cut-out back on top the same way. */}
        <span className="absolute left-1/2 top-[22%] aspect-square w-[34%] -translate-x-1/2 rounded-full bg-[#0b1020]" />
        <span className="absolute left-1/2 top-[50%] h-[60%] w-[72%] -translate-x-1/2 rounded-t-[45%] bg-[#0b1020]" />
        {/* The rest of the line, small in front: the big word isn't repeated in it. */}
        <span className="absolute inset-x-0 top-[57%] text-center text-[11px] font-bold text-white" style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.75)" }}>
          this made me
        </span>
      </span>
    );
  if (style === "clean")
    return (
      <p className="text-[13px] font-semibold leading-snug text-white" style={{ textShadow: "0 1px 6px rgb(0 0 0 / 0.75)" }}>
        Here are <span style={{ color: YELLOW }}>three</span> tricks
      </p>
    );
  if (style === "karaoke")
    return (
      <p className="reel-karaoke text-sm font-extrabold leading-snug" style={{ WebkitTextStroke: "0.6px #000", backgroundImage: `linear-gradient(90deg, ${YELLOW} 50%, #fff 50%)` }}>
        Words fill in as you speak
      </p>
    );
  return (
    <p className="text-[11px] font-medium lowercase text-white/60" style={{ textShadow: "0 1px 4px rgb(0 0 0 / 0.7)" }}>
      small and <span className="font-bold text-white">quiet</span>
    </p>
  );
}

/** The caption looks, each with a small preview, as a radio group. */
export function StylePicker({ value, onChange }: { value: ReelStyle; onChange: (style: ReelStyle) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5" role="radiogroup" aria-label="Caption style">
      {/* The karaoke fill runs on a loop, unless the viewer asks for less motion. */}
      <style>{`.reel-karaoke{color:transparent;-webkit-background-clip:text;background-clip:text;background-size:200% 100%;background-position:100% 0}@media (prefers-reduced-motion:no-preference){.reel-karaoke{animation:reel-fill 2.4s linear infinite}}@keyframes reel-fill{from{background-position:100% 0}to{background-position:0 0}}`}</style>
      {REEL_STYLES.map((style) => {
        const selected = value === style;
        return (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${REEL_STYLE_INFO[style].label}: ${REEL_STYLE_INFO[style].hint}`}
            onClick={() => onChange(style)}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-lg border text-left transition-colors",
              selected ? "border-gray-1000 ring-1 ring-gray-1000" : "border-gray-alpha-400 hover:border-gray-alpha-500",
            )}
          >
            <span
              className={cn(
                "flex aspect-[4/3] w-full justify-center text-center sm:aspect-[4/5]",
                style === "behind" ? "items-stretch" : style === "minimal" ? "items-end px-2 pb-4" : "items-center px-2",
              )}
              style={{ background: "radial-gradient(60% 45% at 50% 22%, #6b7aa1 0%, transparent 70%), linear-gradient(160deg, #273150, #10141f)" }}
              aria-hidden
            >
              <Sample style={style} />
            </span>
            <span className="block border-t border-gray-alpha-400 bg-background-100 p-2.5 sm:p-3">
              <span className="block text-sm font-medium text-gray-1000">{REEL_STYLE_INFO[style].label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-gray-900">{REEL_STYLE_INFO[style].hint}</span>
            </span>
            {selected && (
              <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-white text-black">
                <Check className="size-3" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
