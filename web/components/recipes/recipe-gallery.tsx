"use client";
import { ArrowRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RECIPE_CATEGORIES, RECIPES, usedRecipeCategories, type Recipe, type RecipeCategory } from "@launchreel/core/recipes";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/input";
import { RecipeCard } from "./recipe-card";

const CATEGORIES = usedRecipeCategories();
const label = (c: RecipeCategory) => RECIPE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

// A row per category only pays off once every category can fill one; until then a single grid has no gaps.
const ROW_MIN = 4;
const ROWS = CATEGORIES.every((c) => RECIPES.filter((r) => r.category === c.value).length >= ROW_MIN);

/**
 * The recipe gallery: a search box, category chips, then the recipes, live first. Once every category has enough
 * recipes it shows a row per category that scrolls sideways; until then (and always when filtered) one grid.
 * "Start from scratch" sits above them. On the public site a card opens the recipe's page; in the dashboard it opens
 * the recipe's panel, carrying the customer's URL if they already typed one. `limit` keeps the homepage to a couple of
 * rows until someone filters.
 */
export function RecipeGallery({ base, url, limit }: { base: "public" | "dashboard"; url?: string; limit?: number }) {
  const [category, setCategory] = useState<RecipeCategory | "all">("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matches = (r: Recipe) => !q || [r.name, r.pitch, label(r.category), ...r.platforms].some((s) => s.toLowerCase().includes(q));
  const filtered = category !== "all" || Boolean(q);
  const shown = RECIPES.filter((r) => (category === "all" || r.category === category) && matches(r));
  const withUrl = (path: string) => (url ? `${path}?url=${encodeURIComponent(url)}` : path);
  const href = (r: Recipe) => (base === "public" ? `/recipes/${r.id}` : withUrl(`/dashboard/recipes/${r.id}`));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="shrink-0 sm:w-72">
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes" aria-label="Search recipes" prefix={<Search className="size-4" />} />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
          {[{ value: "all" as const, label: "All" }, ...CATEGORIES].map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[13px] transition-colors sm:h-8",
                category === c.value ? "border-gray-1000 bg-gray-1000 text-background-100" : "border-gray-alpha-400 text-gray-900 hover:border-gray-alpha-500 hover:text-gray-1000",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <Link
        href={withUrl("/dashboard/new")}
        className="group flex items-center gap-3 rounded-xl border border-dashed border-gray-alpha-500 bg-background-100 px-4 py-3 transition-colors hover:border-gray-1000"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-alpha-400">
          <Plus className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Start from scratch</span>
          <span className="block text-[13px] text-gray-900">Choose every option yourself, step by step.</span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-gray-900 transition-transform group-hover:translate-x-0.5" />
      </Link>

      {ROWS && !filtered ? (
        CATEGORIES.map((c) => (
          <section key={c.value} aria-label={c.label}>
            <h2 className="mb-3 text-base font-semibold tracking-tight">{c.label}</h2>
            <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
              {RECIPES.filter((r) => r.category === c.value).map((r) => (
                <RecipeCard key={r.id} recipe={r} href={href(r)} className="w-[300px] shrink-0 snap-start" />
              ))}
            </div>
          </section>
        ))
      ) : shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(filtered || !limit ? shown : shown.slice(0, limit)).map((r) => (
            <RecipeCard key={r.id} recipe={r} href={href(r)} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-alpha-500 p-8 text-center">
          <p className="font-medium">No recipe for that yet.</p>
          <p className="mt-1 text-sm text-gray-900">Start from scratch above and choose every option yourself.</p>
        </div>
      )}
    </div>
  );
}
