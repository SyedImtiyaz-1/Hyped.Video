"use client";
import { FILTERS, REEL_FILTERS, type ReelFilter, type ReelPicture } from "@launchreel/core/picture";
import { cn } from "@/lib/cn";
import { PictureLayers, useVideoFilter } from "./picture-layers";

const STILL = { zoom: 0, dx: 0, dy: 0, white: 0, black: 0, blur: 0, rgb: 0, noise: 0 };

/** The sample frame through a filter, as the render colours it. */
function FilterThumb({ filter }: { filter: ReelFilter }) {
  const picture: ReelPicture = { filter, strength: 1, grain: false, vignette: false, letterbox: false };
  const { filter: css, svg } = useVideoFilter(picture, STILL, 80);
  return (
    <span className="relative block aspect-[9/16] w-full overflow-hidden rounded-md bg-[#1a1d24]">
      {svg}
      {/* eslint-disable-next-line @next/next/no-img-element -- the shared sample still */}
      <img src="/reels/sample-frame.jpg" alt="" className="absolute inset-0 size-full object-cover" style={{ filter: css }} loading="lazy" decoding="async" />
      <PictureLayers picture={picture} fx={STILL} />
    </span>
  );
}

const OVERLAYS: [keyof Pick<ReelPicture, "grain" | "vignette" | "letterbox">, string, string][] = [
  ["grain", "Film grain", "Fine moving grain, like film"],
  ["vignette", "Vignette", "Darker toward the corners"],
  ["letterbox", "Letterbox", "Black bars top and bottom, cinema-style"],
];

/** The whole reel's look: a colour filter and how strong, and overlays. */
export function FiltersPanel({ picture, onChange }: { picture: ReelPicture; onChange: (patch: Partial<ReelPicture>, group?: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[13px] text-gray-900">A filter colours the whole reel; the preview shows it as it will render.</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {REEL_FILTERS.map((filter) => (
            <button key={filter} type="button" aria-pressed={picture.filter === filter} onClick={() => onChange({ filter, strength: picture.filter === filter ? picture.strength : 1 })} className={cn("rounded-lg border p-1.5 text-left transition-colors", picture.filter === filter ? "border-gray-1000 ring-1 ring-gray-1000" : "border-gray-alpha-400 hover:border-gray-alpha-600")}>
              <FilterThumb filter={filter} />
              <span className="mt-1 block truncate text-[13px] font-medium text-gray-1000">{FILTERS[filter].label}</span>
            </button>
          ))}
        </div>
        {picture.filter !== "none" && (
          <label className="mt-3 flex items-center gap-3 text-[13px] text-gray-900">
            Strength
            <input type="range" min={0.1} max={1} step={0.05} value={picture.strength} onChange={(e) => onChange({ strength: Number(e.target.value) }, "strength")} className="h-1 min-w-0 flex-1 accent-[var(--ds-gray-1000)]" aria-label="Filter strength" />
            <span className="w-10 text-right tabular-nums text-gray-1000">{Math.round(picture.strength * 100)}%</span>
          </label>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-1000">Overlays</p>
        {OVERLAYS.map(([key, label, hint]) => (
          <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-alpha-400 p-3 text-sm">
            <input type="checkbox" checked={picture[key]} onChange={(e) => onChange({ [key]: e.target.checked })} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
            <span>
              <span className="block font-medium text-gray-1000">{label}</span>
              <span className="mt-0.5 block text-xs text-gray-900">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
