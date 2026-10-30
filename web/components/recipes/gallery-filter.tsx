"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ALL_RECIPES, usedRecipeCategories, type RecipeCategory } from "@launchreel/core/recipes";
import { cn } from "@/lib/cn";

type Type = RecipeCategory | "all";
const Ctx = createContext<{ type: Type; setType: (type: Type) => void; jump: number; pick: (type: RecipeCategory) => void } | null>(null);

/**
 * The home page's template filter, shared by the category chips under the prompt box and the gallery below: a chip sets
 * the gallery's type, opens its tab and scrolls to it (`jump` counts the picks). Elsewhere the gallery keeps its own.
 */
export function GalleryFilterProvider({ children }: { children: React.ReactNode }) {
  const [type, setType] = useState<Type>("all");
  const [jump, setJump] = useState(0);
  const pick = useCallback((next: RecipeCategory) => (setType(next), setJump((j) => j + 1)), []);
  const value = useMemo(() => ({ type, setType, jump, pick }), [type, jump, pick]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useGalleryFilter = () => useContext(Ctx);

const CATEGORIES = usedRecipeCategories(ALL_RECIPES);

// The chips' words, as Cardboard's read, for the gallery's categories.
const CHIP: Partial<Record<RecipeCategory, string>> = { launch: "Launch video", product: "Product demo", ads: "Ad / Promo", dev: "Developers" };

/** The template types as chips under the home's prompt box: one opens its templates in the gallery below. */
export function CategoryChips({ className }: { className?: string }) {
  const filter = useGalleryFilter();
  if (!filter) return null;
  return (
    <div role="group" aria-label="Template types" className={cn("flex gap-2 overflow-x-auto [scrollbar-width:none] md:flex-wrap md:justify-center md:overflow-visible", className)}>
      {CATEGORIES.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => filter.pick(c.value)}
          aria-pressed={filter.type === c.value}
          className={cn(
            "h-9 shrink-0 rounded-full px-3.5 text-[13px] font-medium text-gray-1000 transition-colors",
            filter.type === c.value ? "bg-brand/15 ring-1 ring-inset ring-brand/60" : "bg-gray-alpha-200 hover:bg-gray-alpha-300",
          )}
        >
          {CHIP[c.value] ?? c.label}
        </button>
      ))}
    </div>
  );
}
