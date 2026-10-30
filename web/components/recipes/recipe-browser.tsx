"use client";
import { ChevronDown, Ratio, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ALL_RECIPES, usedRecipeCategories, type Recipe, type RecipeCategory } from "@launchreel/core/recipes";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useGalleryFilter } from "./gallery-filter";
import { RATIO } from "./labels";
import { RecipeTile, categoryLabel } from "./recipe-tile";
import { ScrollRow } from "./scroll-row";

const CATEGORIES = usedRecipeCategories(ALL_RECIPES);

// Short-form is what a feed plays through: up to 30 seconds.
const SHORT_MAX = 30;
const LENGTHS = [
  { value: "all", label: "All", title: undefined },
  { value: "short", label: "Short-form", title: `Up to ${SHORT_MAX} seconds` },
  { value: "long", label: "Long-form", title: `Longer than ${SHORT_MAX} seconds` },
] as const;
type Length = (typeof LENGTHS)[number]["value"];

const SIZES: { value: Recipe["format"]; label: string }[] = [
  { value: "landscape", label: `${RATIO.landscape} Landscape` },
  { value: "vertical", label: `${RATIO.vertical} Vertical` },
  { value: "square", label: `${RATIO.square} Square` },
];

/**
 * Every recipe (the reel styles too), a row per category, with a search and filters for length, size and type.
 * Filtered, it's one wrapping set of tiles. A size carries into the recipe it opens; so does a link the customer typed
 * before (`url`). On the home page its type is the chips' (gallery-filter.tsx), and picking one scrolls here.
 */
export function RecipeBrowser({ title = "Pick a template to remix", url }: { title?: string; url?: string }) {
  const filter = useGalleryFilter();
  const section = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [length, setLength] = useState<Length>("all");
  const [size, setSize] = useState<Recipe["format"] | "all">("all");
  const [ownType, setOwnType] = useState<RecipeCategory | "all">("all");
  const type = filter?.type ?? ownType;
  const setType = filter?.setType ?? setOwnType;
  useEffect(() => {
    if (!filter?.jump) return;
    // Two frames on: the home's tabs show this panel in their own effect, which runs after this one.
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => section.current?.scrollIntoView({ behavior: "smooth", block: "start" })));
    return () => cancelAnimationFrame(frame);
  }, [filter?.jump]);
  const q = query.trim().toLowerCase();
  const filtered = Boolean(q) || length !== "all" || size !== "all" || type !== "all";
  const shown = ALL_RECIPES.filter(
    (r) =>
      (!q || [r.name, r.pitch, categoryLabel(r.category), ...r.platforms].some((s) => s.toLowerCase().includes(q))) &&
      (length === "all" || (length === "short") === r.durationSec <= SHORT_MAX) &&
      (size === "all" || r.formats.includes(size)) &&
      (type === "all" || r.category === type),
  );
  const open = { url, format: size === "all" ? undefined : size };
  const clear = () => (setQuery(""), setLength("all"), setSize("all"), setType("all"));

  return (
    <section ref={section} aria-label={title} className="scroll-mt-20 space-y-6">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="lg:w-72">
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates" aria-label="Search templates" prefix={<Search className="size-4" />} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Length" className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-gray-alpha-100 p-1">
              {LENGTHS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={length === l.value}
                  title={l.title}
                  onClick={() => setLength(l.value)}
                  className={cn("h-7 rounded-md px-3 text-[13px] transition-colors", length === l.value ? "bg-background-100 font-medium text-gray-1000 shadow-sm" : "text-gray-900 hover:text-gray-1000")}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <Menu label="Size" icon={<Ratio className="size-3.5" />} value={size} onChange={(v) => setSize(v as typeof size)} options={[{ value: "all", label: "All sizes" }, ...SIZES]} />
            <Menu label="Type" value={type} onChange={(v) => setType(v as typeof type)} options={[{ value: "all", label: "All types" }, ...CATEGORIES]} />
          </div>
        </div>
      </div>

      {!filtered ? (
        <div className="space-y-6">
          {CATEGORIES.map((c) => (
            <ScrollRow key={c.value} title={c.label} className="h-[180px] md:h-[200px]">
              {ALL_RECIPES.filter((r) => r.category === c.value).map((r) => (
                <RecipeTile key={r.id} recipe={r} open={open} />
              ))}
            </ScrollRow>
          ))}
        </div>
      ) : shown.length ? (
        <div>
          <p className="mb-3 text-[13px] text-gray-900">
            {shown.length} of {ALL_RECIPES.length} templates ·{" "}
            <button type="button" onClick={clear} className="underline underline-offset-2 hover:text-gray-1000">
              Clear filters
            </button>
          </p>
          <div className="flex flex-wrap gap-3 [&>*]:h-[180px] md:[&>*]:h-[200px]">
            {shown.map((r) => (
              <RecipeTile key={r.id} recipe={r} open={open} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-alpha-500 p-8 text-center">
          <p className="font-medium">No template for that yet.</p>
          <p className="mt-1 text-sm text-gray-900">
            Try another filter, or{" "}
            <button type="button" onClick={clear} className="underline underline-offset-2 hover:text-gray-1000">
              see every template
            </button>
            .
          </p>
        </div>
      )}
    </section>
  );
}

/** A filter as a pill over the browser's own menu, which is the easiest to use on a phone and with a keyboard. */
function Menu({ label, icon, value, options, onChange }: { label: string; icon?: React.ReactNode; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-900">{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 appearance-none rounded-lg border border-gray-alpha-400 bg-background-100 pr-8 text-[13px] font-medium text-gray-1000 transition-colors hover:border-gray-alpha-500",
          icon ? "pl-8" : "pl-3",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-900" />
    </label>
  );
}
