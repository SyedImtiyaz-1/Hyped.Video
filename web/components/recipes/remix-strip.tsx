"use client";
import { LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { recipeById } from "@launchreel/core/recipes";
import { CLIP_ACCEPT, useClip } from "@/components/create/use-clip";
import { cn } from "@/lib/cn";
import { SHOWCASE, type ShowcaseVideo } from "@/lib/showcase";
import { SampleMedia, TILE, TileCaption, useOpenRecipe } from "./recipe-tile";
import { ScrollRow } from "./scroll-row";

// The samples on the homepage's gallery, each made with a live recipe.
const SAMPLES = SHOWCASE.filter((v) => v.gallery !== false && recipeById(v.template)?.status === "live");

const SHAPE: Record<ShowcaseVideo["format"], string> = { landscape: "aspect-video", vertical: "aspect-[9/16]", square: "aspect-square" };

/**
 * The top of the recipes: videos Hyped made, each opening the recipe it was made with, behind a tile for a clip of the
 * customer's own (it goes to the reel form, as the prompt box's upload does).
 */
export function RemixStrip({ title = "Remix a video" }: { title?: string }) {
  const { busy, start } = useClip();
  const file = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (picked: File | undefined) => {
    setError(null);
    const problem = await start(picked);
    if (problem) setError(problem);
  };
  return (
    <div>
      <input ref={file} type="file" accept={CLIP_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void pick(e.target.files?.[0])} />
      <ScrollRow title={title} big className="h-[200px] md:h-[220px]">
        <button
          type="button"
          onClick={() => file.current?.click()}
          onDragOver={(e) => e.dataTransfer.types.includes("Files") && (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => (e.preventDefault(), setDragging(false), void pick(e.dataTransfer.files?.[0]))}
          className={cn(
            "flex h-full w-[168px] shrink-0 snap-start flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed px-4 text-center transition-colors",
            dragging ? "border-brand bg-brand/10" : "border-gray-alpha-500 hover:border-gray-1000",
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-lg border border-gray-alpha-400 bg-background-100">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
          </span>
          <span className="text-sm font-medium">{dragging ? "Drop it here" : "Upload a clip"}</span>
          <span className="text-[12px] leading-4 text-gray-900">We&apos;ll cut it, caption it and add B-roll</span>
        </button>
        {SAMPLES.map((v) => (
          <Sample key={v.id} video={v} />
        ))}
      </ScrollRow>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-red-900">
          {error}
        </p>
      )}
    </div>
  );
}

function Sample({ video: v }: { video: ShowcaseVideo }) {
  const open = useOpenRecipe();
  const [broken, setBroken] = useState(false);
  const recipe = recipeById(v.template);
  if (!recipe || broken) return null;
  return (
    <a href={`/dashboard/recipes/${recipe.id}`} onClick={(e) => open(e, recipe.id)} aria-label={`Remix ${recipe.name}, made for ${v.product}`} className={cn(TILE, SHAPE[v.format])}>
      <SampleMedia video={v} onBroken={() => setBroken(true)} autoplay />
      <TileCaption title={recipe.name} detail={`${v.product} · ${v.durationSec}s`} />
    </a>
  );
}
