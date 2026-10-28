"use client";
import { ArrowRight, Mic, MicOff, Play, Square } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { creditsFor } from "@launchreel/core/pricing";
import { RECIPE_CATEGORIES, type Recipe } from "@launchreel/core/recipes";
import { voiceById } from "@launchreel/core/voices";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { showcaseFor, videoSrc } from "@/lib/showcase";
import { RATIO, TIER_LABEL } from "./labels";

/** A recipe's storyboard in its own frame shape: its category, name and beats. A sample can play over it. */
export function RecipeStoryboard({ recipe: r, children }: { recipe: Recipe; children?: React.ReactNode }) {
  const beats = r.video?.beats ?? [];
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100 p-3 shadow-sm",
        r.format === "landscape" ? "aspect-video w-[88%]" : r.format === "vertical" ? "aspect-[9/16] h-full" : "aspect-square h-full",
      )}
    >
      {children}
      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-900">{RECIPE_CATEGORIES.find((c) => c.value === r.category)?.label}</span>
      <span className={cn("mt-1 font-semibold leading-tight tracking-tight", r.format === "vertical" ? "text-sm" : "text-base")}>{r.name}</span>
      {beats.length > 0 && (
        <div className="mt-auto space-y-1">
          <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            {beats.map((b, i) => (
              <span key={i} title={`${b.from}-${b.to}s ${b.label}`} className={cn("h-full rounded-full", i % 2 ? "bg-gray-alpha-500" : "bg-gray-1000")} style={{ flexGrow: b.to - b.from }} />
            ))}
          </div>
          {r.format === "landscape" && <p className="truncate text-[10px] text-gray-900">{beats.map((b) => b.label).join(" → ")}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * A recipe in the gallery: its storyboard, with a video Hyped made from it playing over it (on hover with a mouse, or
 * with the button), then what it is, what it costs, and the way in. "Soon" recipes show without the way in.
 */
export function RecipeCard({ recipe: r, href, className }: { recipe: Recipe; href: string; className?: string }) {
  const voice = voiceById(r.video?.voice);
  const example = showcaseFor(r.id);
  const soon = r.status === "soon";
  const [preview, setPreview] = useState(false);
  const [shown, setShown] = useState(false);
  const stop = () => {
    setPreview(false);
    setShown(false);
  };
  return (
    <div
      onPointerEnter={(e) => example && e.pointerType === "mouse" && setPreview(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && stop()}
      className={cn("group flex flex-col overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-100 transition-colors hover:border-gray-alpha-500", className)}
    >
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden border-b border-gray-alpha-400 bg-background-200 p-4">
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_30%_20%,var(--ds-gray-alpha-200),transparent_60%)]" />
        {example && (
          <button
            type="button"
            onClick={() => (preview ? stop() : setPreview(true))}
            aria-pressed={preview}
            aria-label={preview ? `Stop the ${r.name} example` : `Play an example made with ${r.name}`}
            className="absolute bottom-2 right-2 z-10 inline-flex h-7 items-center gap-1 rounded-full border border-gray-alpha-400 bg-background-100/90 px-2.5 text-[11px] font-medium text-gray-1000 backdrop-blur-sm transition-colors hover:border-gray-1000"
          >
            {preview ? <Square className="size-3" fill="currentColor" /> : <Play className="size-3" fill="currentColor" />}
            Example
          </button>
        )}
        {soon && <span className="absolute left-2 top-2 z-10 rounded-full bg-gray-1000 px-2 py-0.5 text-[11px] font-medium text-background-100">Soon</span>}
        <RecipeStoryboard recipe={r}>
          {preview && example && (
            <video
              src={videoSrc(example)}
              autoPlay
              muted
              loop
              playsInline
              onPlaying={() => setShown(true)}
              aria-label={`Example made with ${r.name}`}
              className={cn("absolute inset-0 z-10 size-full bg-black object-cover transition-opacity duration-300", shown ? "opacity-100" : "opacity-0")}
            />
          )}
        </RecipeStoryboard>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold">{r.name}</h3>
        <p className="mt-0.5 text-sm text-gray-900">{r.pitch}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-[12px] text-gray-900">
          <li className={cn("rounded-full border px-2 py-0.5", r.tier === "studio" ? "border-gray-1000 text-gray-1000" : "border-gray-alpha-400")}>{TIER_LABEL[r.tier]}</li>
          <li className="rounded-full border border-gray-alpha-400 px-2 py-0.5 tabular-nums">{r.durationSec}s</li>
          <li className="rounded-full border border-gray-alpha-400 px-2 py-0.5">{RATIO[r.format]}</li>
          {r.kind === "video" && (
            <li className="flex items-center gap-1 rounded-full border border-gray-alpha-400 px-2 py-0.5">
              {voice ? <Mic className="size-3" /> : <MicOff className="size-3" />}
              {voice ? voice.name : "No voice"}
            </li>
          )}
          {/* Reels are paid from their own balance (REEL_PACKS), so only product videos show a credit cost. */}
          <li className="rounded-full border border-gray-alpha-400 px-2 py-0.5 tabular-nums">{r.kind === "video" ? plural(creditsFor("newVideo", r.durationSec, r.tier), "credit") : "Reel"}</li>
        </ul>
        <p className="mb-4 mt-3 text-[12px] text-gray-900">For {r.platforms.join(", ")}</p>
        {soon ? (
          <span className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-dashed border-gray-alpha-400 text-sm text-gray-900">Coming soon</span>
        ) : (
          <Link
            href={href}
            className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gray-alpha-400 text-sm font-medium transition-colors hover:border-gray-1000 group-hover:border-gray-1000"
          >
            Use recipe
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
