"use client";
import { useEffect, useRef, useState } from "react";
import { EDIT_STYLES, type ReelEditStyle } from "@launchreel/core/edit-styles";
import { RECIPE_CATEGORIES, type Recipe, type RecipeCategory } from "@launchreel/core/recipes";
import { serifUpright } from "@/components/create/serif";
import { StyleFrame, useTick } from "@/components/reels/style-picker";
import { cn } from "@/lib/cn";
import { posterSrc, showcaseFor, videoSrc, type ShowcaseVideo } from "@/lib/showcase";
import { useRecipeModal, type RecipeOpenOptions } from "./recipe-modal-context";

// Each category's tint on a cover, so a row of recipes without samples still reads at a glance.
const TINT: Record<RecipeCategory, string> = {
  launch: "200 241 53",
  product: "90 150 255",
  "talking-head": "255 130 90",
  vlog: "255 200 80",
  clipping: "240 90 160",
  aftermovie: "150 110 255",
  updates: "255 180 60",
  ads: "255 90 140",
  dev: "120 220 200",
};

export const categoryLabel = (c: RecipeCategory) => RECIPE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

/** A recipe's cover until we've made a sample with it: its category, its name in the display serif, and its beats. */
export function RecipeCover({ recipe: r, large, className }: { recipe: Recipe; large?: boolean; className?: string }) {
  const beats = r.video?.beats ?? [];
  return (
    <div
      className={cn("flex size-full flex-col bg-gray-100", large ? "p-6" : "p-3", className)}
      style={{ backgroundImage: `radial-gradient(130% 90% at 0% 0%, rgb(${TINT[r.category]} / 0.3), transparent 62%)` }}
    >
      <span className={cn("font-medium uppercase tracking-wider text-gray-900", large ? "text-xs" : "text-[10px]")}>{categoryLabel(r.category)}</span>
      <span className={cn(serifUpright.className, "mt-1 leading-[1.05] text-gray-1000", large ? "text-[44px]" : "text-[22px]")}>{r.name}</span>
      {beats.length > 0 && (
        <div className={cn("mt-auto flex gap-0.5 overflow-hidden rounded-full", large ? "h-1.5" : "h-1")}>
          {beats.map((b, i) => (
            <span key={i} title={large ? `${b.from}–${b.to}s ${b.label}` : undefined} className={cn("h-full rounded-full", i % 2 ? "bg-gray-alpha-500" : "bg-gray-1000")} style={{ flexGrow: b.to - b.from }} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A reel style's cover: the reel form's sample frame with the style's captions playing over it, in its grade. */
export function ReelCover({ style }: { style: ReelEditStyle }) {
  const tick = useTick();
  const spec = EDIT_STYLES[style];
  return <StyleFrame style={spec.options.style} changes={spec.options.look} fonts={spec.options.fonts} picture={spec.picture} tick={tick} className="size-full" />;
}

// Until each reel style has a sample reel of its own, they share one sample frame: each frames it differently (a close-up,
// a wide shot), which also makes the captions readable at tile size.
const REEL_FRAMING: Record<ReelEditStyle, { zoom: number; origin: string }> = {
  creator: { zoom: 1.35, origin: "50% 42%" },
  clean: { zoom: 1, origin: "50% 50%" },
  behind: { zoom: 1.12, origin: "50% 28%" },
  podcast: { zoom: 1.5, origin: "42% 58%" },
  hype: { zoom: 1.22, origin: "58% 48%" },
  cinematic: { zoom: 1, origin: "50% 50%" },
};

/**
 * A sample's poster filling its tile, playing (muted) while a mouse is over it, or with `autoplay` while it's on screen:
 * off screen it stops, so only what's seen downloads. Still with reduced motion. `onBroken` when the poster won't load.
 */
export function SampleMedia({ video, onBroken, autoplay }: { video: ShowcaseVideo; onBroken?: () => void; autoplay?: boolean }) {
  const box = useRef<HTMLSpanElement>(null);
  const [playing, setPlaying] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!autoplay || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const watch = new IntersectionObserver(([entry]) => (setPlaying(entry.isIntersecting), entry.isIntersecting || setShown(false)), { threshold: 0.6 });
    watch.observe(el);
    return () => watch.disconnect();
  }, [autoplay]);
  return (
    <span
      ref={box}
      className="absolute inset-0"
      onPointerEnter={(e) => !autoplay && e.pointerType === "mouse" && setPlaying(true)}
      onPointerLeave={() => !autoplay && (setPlaying(false), setShown(false))}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- posters come from our own storage domain */}
      <img src={posterSrc(video)} alt="" loading="lazy" onError={onBroken} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      {playing && (
        <video
          src={videoSrc(video)}
          autoPlay
          muted
          loop
          playsInline
          onPlaying={() => setShown(true)}
          className={cn("absolute inset-0 size-full object-cover transition-opacity duration-300", shown ? "opacity-100" : "opacity-0")}
        />
      )}
    </span>
  );
}

/** Opens a recipe in the dashboard's modal; a click for a new tab, or no modal around it, follows the link instead. */
export function useOpenRecipe() {
  const modal = useRecipeModal();
  return (e: React.MouseEvent, id: string, options?: RecipeOpenOptions) => {
    if (!modal || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    modal.open(id, options);
  };
}

/** The bottom of a tile: its name (and a detail), on hover or focus; always on touch screens, which can't hover. */
export function TileCaption({ title, detail }: { title: string; detail?: string }) {
  return (
    <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-2.5 pb-2 pt-10 text-left text-[12px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100">
      <span className="line-clamp-2">{title}</span>
      {detail && <span className="shrink-0 tabular-nums text-white/70">{detail}</span>}
    </span>
  );
}

export const TILE = "group relative block h-full shrink-0 snap-start overflow-hidden rounded-xl bg-gray-100 ring-1 ring-inset ring-gray-alpha-300";

// A tile is as tall as its row; its width follows the recipe's shape.
const SHAPE: Record<Recipe["format"], string> = { vertical: "aspect-[3/4]", square: "aspect-square", landscape: "aspect-[16/10]" };

/** A recipe in a gallery row: the sample Hyped made with it, or its cover until there's one. */
export function RecipeTile({ recipe: r, open: options, className }: { recipe: Recipe; open?: RecipeOpenOptions; className?: string }) {
  const open = useOpenRecipe();
  const example = showcaseFor(r.id);
  const [broken, setBroken] = useState(false);
  return (
    <a
      href={`/dashboard/recipes/${r.id}`}
      onClick={(e) => open(e, r.id, options)}
      aria-label={`${r.name}${r.status === "soon" ? " (coming soon)" : ""}: ${r.pitch}`}
      className={cn(TILE, SHAPE[r.format], className)}
    >
      {example && !broken ? (
        <>
          <SampleMedia video={example} onBroken={() => setBroken(true)} />
          <TileCaption title={r.name} detail={`${r.durationSec}s`} />
        </>
      ) : r.reel ? (
        <>
          <span className="absolute inset-0" style={{ transform: `scale(${REEL_FRAMING[r.reel.editStyle].zoom})`, transformOrigin: REEL_FRAMING[r.reel.editStyle].origin }}>
            <ReelCover style={r.reel.editStyle} />
          </span>
          <TileCaption title={r.name} />
        </>
      ) : (
        <RecipeCover recipe={r} />
      )}
      {r.status === "soon" && <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">Soon</span>}
    </a>
  );
}
