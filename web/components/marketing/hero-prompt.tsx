"use client";
import { ArrowRight, ChevronDown, Film, LoaderCircle, Plus } from "lucide-react";
import localFont from "next/font/local";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TRIAL_CREDITS } from "@launchreel/core/pricing";
import { REEL_MAX_BYTES } from "@launchreel/core/reel";
import { LIVE_RECIPES, recipeById, type Recipe } from "@launchreel/core/recipes";
import { cn } from "@/lib/cn";
import { savePendingClip } from "@/lib/pending-clip";
import { pickRecipe, splitPrompt } from "@/lib/prompt";

// The headline's last words, one at a time, in a serif italic (the caption font of the same name, OFL).
const serif = localFont({ src: "../reels/fonts/InstrumentSerif-Italic.ttf", style: "italic", display: "swap" });
const WORDS = ["real product.", "website.", "GitHub repo.", "latest release.", "own clips."];

// Shortcuts under the box: each picks its recipe, as the menu in the box does.
const SHORTCUTS = ["launch-day", "walkthrough", "feature-drop", "three-features", "problem-solution", "readme-loop"].map((id) => recipeById(id)).filter((r): r is Recipe => Boolean(r));

/**
 * The homepage's prompt box: type or paste a website or repo and say what you want, pick a recipe (or leave it on Auto),
 * or add a clip you recorded. A link with words opens the recipe's panel with both filled in (Auto picks the recipe from
 * the words, lib/prompt.ts); a bare link goes to the quick start; a clip goes to the reel form, kept through sign-up.
 */
export function HeroPrompt() {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [recipe, setRecipe] = useState<string | null>(null);
  const [word, setWord] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The headline's words rotate, unless the visitor asked for less motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2600);
    return () => window.clearInterval(timer);
  }, []);

  function start() {
    const { url, words } = splitPrompt(text);
    if (!url) return setError("Add your website or a GitHub repo, like myapp.com or github.com/you/app. Or add a clip you recorded.");
    const id = recipe ?? pickRecipe(words);
    if (!id) return router.push(`/dashboard/start?${new URLSearchParams({ url })}`);
    router.push(`/dashboard/recipes/${id}?${new URLSearchParams({ url, ...(words ? { notes: words } : {}) })}`);
  }

  async function clip(picked: File | undefined) {
    if (!picked || busy) return;
    setError(null);
    if (!/^video\//.test(picked.type) && !/\.(mp4|m4v|mov|webm)$/i.test(picked.name)) return setError("Add a video: MP4, MOV or WebM.");
    if (picked.size > REEL_MAX_BYTES) return setError(`Videos can be up to ${Math.round(REEL_MAX_BYTES / 1024 ** 3)} GB.`);
    setBusy(true);
    // Kept in this browser through sign-up; if it can't be kept, the reel form asks for it again.
    const kept = await savePendingClip(picked, "creator");
    router.push(`/dashboard/reels?pending=${kept ? 1 : 0}&style=creator`);
  }

  return (
    <div className="relative mx-auto w-full max-w-3xl text-center">
      <h1 className="mx-auto min-h-[2.1em] text-[44px] font-semibold leading-[1.05] tracking-[-0.05em] md:text-[76px]">
        Videos made from your{" "}
        <span key={word} className={cn(serif.className, "inline-block pr-1 font-normal tracking-[-0.02em] text-brand motion-safe:animate-word-in")}>
          {WORDS[word]}
        </span>
      </h1>

      <form
        onSubmit={(e) => (e.preventDefault(), start())}
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => (e.preventDefault(), setDragging(false), void clip(e.dataTransfer.files?.[0]))}
        className="mt-10 text-left"
      >
        <div
          className={cn(
            "rounded-2xl bg-[linear-gradient(140deg,rgb(200_241_53/0.6),var(--ds-gray-alpha-400)_32%,var(--ds-gray-alpha-400)_68%,rgb(200_241_53/0.35))] p-px shadow-[0_28px_90px_-30px_rgb(200_241_53/0.45)] transition-shadow",
            dragging && "shadow-[0_0_0_2px_var(--ds-brand),0_28px_90px_-30px_rgb(200_241_53/0.7)]",
          )}
        >
          <div className="rounded-[15px] bg-background-100/95 backdrop-blur">
            <textarea
              value={text}
              onChange={(e) => (setText(e.target.value), setError(null))}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), start())}
              rows={2}
              placeholder={dragging ? "Drop it to edit your clip…" : "Paste your website or GitHub repo and say what you want, or drop a clip…"}
              aria-label="Describe your video"
              className="block w-full resize-none bg-transparent px-5 pt-4 text-base text-gray-1000 outline-none placeholder:text-gray-900 sm:text-lg"
            />
            <div className="flex items-center gap-2 px-3 pb-3 pt-2">
              <input ref={file} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void clip(e.target.files?.[0])} />
              <button
                type="button"
                onClick={() => file.current?.click()}
                aria-label="Add a clip you recorded"
                title="Add a clip you recorded"
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-alpha-400 text-gray-1000 transition-colors hover:border-gray-1000"
              >
                {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              </button>
              <label className="relative">
                <span className="sr-only">Recipe</span>
                <select
                  value={recipe ?? ""}
                  onChange={(e) => setRecipe(e.target.value || null)}
                  className="h-9 max-w-[11rem] appearance-none truncate rounded-full border border-gray-alpha-400 bg-transparent pl-3.5 pr-8 text-[13px] font-medium text-gray-1000 transition-colors hover:border-gray-alpha-500 sm:max-w-none"
                >
                  <option value="">Auto</option>
                  {LIVE_RECIPES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-900" />
              </label>
              <button
                type="submit"
                className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-ink shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-[background-color,box-shadow] hover:bg-brand-hover hover:shadow-neon"
              >
                <span className="hidden sm:inline">Make my free video</span>
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-2 px-2 text-[13px] text-red-900">
            {error}
          </p>
        )}
      </form>

      <div className="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Recipes">
        {SHORTCUTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRecipe((id) => (id === r.id ? null : r.id))}
            aria-pressed={recipe === r.id}
            title={r.pitch}
            className={cn(
              "h-8 rounded-full border px-3 text-[13px] transition-colors",
              recipe === r.id ? "border-brand/60 bg-brand/10 font-medium text-gray-1000" : "border-gray-alpha-400 bg-background-100/60 text-gray-900 hover:border-gray-alpha-500 hover:text-gray-1000",
            )}
          >
            {r.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => file.current?.click()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-alpha-400 bg-background-100/60 px-3 text-[13px] text-gray-900 transition-colors hover:border-gray-alpha-500 hover:text-gray-1000"
        >
          <Film className="size-3.5" /> Edit my clip
        </button>
      </div>

      <p className="mt-5 text-[13px] text-gray-900">
        {TRIAL_CREDITS} free credits, no card. Made from your real UI, copy and fonts, never stock footage.{" "}
        <Link href="/recipes" className="text-gray-1000 underline-offset-2 hover:underline">
          Browse recipes
        </Link>
      </p>
    </div>
  );
}
