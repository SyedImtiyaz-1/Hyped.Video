import type { Recipe } from "@launchreel/core/recipes";
import { cn } from "@/lib/cn";
import { posterSrc, showcaseFor, videoSrc } from "@/lib/showcase";
import { RecipeStoryboard } from "./recipe-card";

// The sample at its own shape, as large as the column allows.
const FRAME: Record<Recipe["format"], string> = {
  landscape: "aspect-video w-full",
  vertical: "aspect-[9/16] h-[min(70vh,640px)]",
  square: "aspect-square w-full max-w-[520px]",
};

/** A product-video recipe's story, beat by beat, timed as the recipe is (the agent scales it to the chosen length). */
export function RecipeStory({ recipe: r }: { recipe: Recipe }) {
  const beats = r.video?.beats ?? [];
  if (!beats.length) return null;
  return (
    <ol className="divide-y divide-gray-alpha-400 rounded-xl border border-gray-alpha-400 bg-background-100">
      {beats.map((b, i) => (
        <li key={i} className="flex gap-4 px-4 py-3 text-sm">
          <span className="w-14 shrink-0 pt-px font-mono text-xs tabular-nums text-gray-900">
            {b.from}–{b.to}s
          </span>
          <span>
            <span className="font-medium text-gray-1000">{b.label}.</span> <span className="text-gray-900">{b.text}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A recipe's sample video with controls, or its storyboard until we've made one. */
export function RecipeSample({ recipe: r }: { recipe: Recipe }) {
  const example = showcaseFor(r.id);
  return (
    <div className="flex justify-center rounded-2xl border border-gray-alpha-400 bg-background-200 p-4 md:p-6">
      {example ? (
        <video
          src={videoSrc(example)}
          poster={posterSrc(example)}
          controls
          playsInline
          preload="metadata"
          aria-label={`A video made with ${r.name}`}
          className={cn("block rounded-lg bg-black", FRAME[example.format])}
        />
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center">
          <RecipeStoryboard recipe={r} />
        </div>
      )}
    </div>
  );
}
