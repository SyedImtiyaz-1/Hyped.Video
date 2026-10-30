"use client";
import { ArrowRight, ArrowUp, ChevronDown, Film, LoaderCircle, Plus, Sparkles, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { LIVE_RECIPES, recipeById, type Recipe } from "@launchreel/core/recipes";
import { REEL_DEFAULTS } from "@launchreel/core/reel";
import { useReelUpload } from "@/components/reels/use-reel-upload";
import { cn } from "@/lib/cn";
import { handClip } from "@/lib/clip-handoff";
import { pickRecipe, splitPrompt } from "@/lib/prompt";
import { CLIP_ACCEPT, useClip } from "./use-clip";

// Shortcuts under the box: each picks its recipe, as the menu in the box does.
const SHORTCUTS = ["launch-day", "walkthrough", "feature-drop", "three-features", "problem-solution", "readme-loop"].map((id) => recipeById(id)).filter((r): r is Recipe => Boolean(r));

// Ready-made asks (each one worded so "Auto" picks its recipe; lib/prompt.ts): the sparkle button writes one in.
const IDEAS = ["A launch video for Product Hunt", "Show how it works, step by step", "Announce our newest feature on X", "A 20-second TikTok ad that starts with the pain"];

/**
 * The prompt box, on the homepage ("hero") and the dashboard ("app"): type or paste a website or repo and say what you
 * want, pick a recipe (or leave it on Auto), or add a clip you recorded.
 *
 * In the dashboard it starts at once, as Cardboard's does, and opens the editor on the first cut: a link starts the
 * video with the recipe's choices (Auto picks it from the words; a bare link gets the quick start's), the words as its
 * notes; a clip is uploaded and starts a reel, the words kept for Ask AI. The line under the box says what Enter does
 * (it spends credits and confirms the customer may use the product or clip). On the public site a link opens the
 * recipe's page (a bare one the quick start), and a clip the reel form, kept in this browser through sign-up.
 *
 * The app variant has an upload tile on the box, a sparkle that writes in an idea, a round send button and filled chips.
 * `shortcuts={false}` leaves the chips out, for a page that puts its own under the box (the dashboard's categories).
 * `demo`: demo mode can't upload or make videos, so a clip opens in the editor straight from this computer
 * (/dashboard/edit/local, handed over in memory), and a link says it needs the full stack.
 */
export function PromptBox({ variant = "hero", cta = "Make my video", shortcuts = true, demo = false, className }: { variant?: "hero" | "app"; cta?: string; shortcuts?: boolean; demo?: boolean; className?: string }) {
  const app = variant === "app";
  const router = useRouter();
  const { busy: keeping, start: keepClip } = useClip();
  const reel = useReelUpload();
  const box = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const idea = useRef(0);
  const [text, setText] = useState("");
  const [recipe, setRecipe] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = keeping || starting || reel.measuring || reel.busy;
  const problem = error ?? reel.error?.message ?? null;

  function start() {
    if (busy) return;
    const { url, words } = splitPrompt(text);
    if (!url) return setError("Add your website or a GitHub repo, like myapp.com or github.com/you/app. Or add a clip you recorded.");
    const id = recipe ?? pickRecipe(words);
    if (app) return void startVideo(url, words, id);
    if (!id) return router.push(`/dashboard/start?${new URLSearchParams({ url })}`);
    router.push(`/dashboard/recipes/${id}?${new URLSearchParams({ url, ...(words ? { notes: words } : {}) })}`);
  }

  // The dashboard's start: the request /api/jobs takes from a recipe's panel, without the panel.
  async function startVideo(url: string, words: string, id: string | null) {
    // A website's video is made by the agent on the server, which demo mode doesn't have.
    if (demo) return setError("Demo mode can't make a video from a website: that needs the full stack (about 10–20 minutes). Add a clip instead: it opens in the editor right away.");
    const r = recipeById(id);
    const story = r?.video;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl: url,
          notes: words || undefined,
          ...(r && story ? { template: r.id, format: r.format, durationSec: r.durationSec, videoType: story.videoType, tone: story.tone || undefined, music: story.music, voice: story.voice } : {}),
          captions: true,
          quality: "standard",
          ownershipConfirmed: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(`${data.error ?? "Could not start the video."}${data.upgrade ? " Buy credits under Billing." : ""}${res.status === 422 ? " A private repo needs a token: use New video." : ""}`);
      router.push(`/dashboard/videos/${data.id}/edit`);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setStarting(false);
    }
  }

  async function clip(picked: File | undefined) {
    setError(null);
    if (app) {
      // The words typed with it are what to change, waiting in the editor's Ask AI.
      const chosen = await reel.choose(picked);
      // Demo mode can't upload: the clip opens in the editor straight from this computer (/dashboard/edit/local).
      if (chosen && demo) {
        setStarting(true);
        handClip(chosen.file);
        return router.push("/dashboard/edit/local");
      }
      if (chosen) await reel.start({ ...REEL_DEFAULTS }, text.trim() || undefined, chosen);
      return;
    }
    const wrong = await keepClip(picked);
    if (wrong) setError(wrong);
  }

  // The next idea replaces the words but keeps a link already typed; without one, the box waits for it.
  function writeIdea() {
    const next = IDEAS[idea.current++ % IDEAS.length];
    const { url } = splitPrompt(text);
    setText(url ? `${url} ${next}` : `${next} for `);
    setRecipe(null);
    setError(null);
    box.current?.focus();
  }

  const recipeMenu = (
    <label className="relative">
      <span className="sr-only">{app ? "Template" : "Recipe"}</span>
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
  );

  return (
    <div className={cn("w-full text-left", className)}>
      <form
        onSubmit={(e) => (e.preventDefault(), start())}
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => (e.preventDefault(), setDragging(false), void clip(e.dataTransfer.files?.[0]))}
        className={cn("relative", app && "pt-6")}
      >
        <input ref={file} type="file" accept={CLIP_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (void clip(e.target.files?.[0]), (e.target.value = ""))} />
        {app && (
          <button
            type="button"
            onClick={() => file.current?.click()}
            aria-label="Add a clip you recorded"
            title="Add a clip you recorded"
            className="absolute left-5 top-0 z-10 flex h-14 w-20 items-center justify-center rounded-xl border border-dashed border-gray-alpha-500 bg-background-100 text-gray-1000 shadow-sm transition-colors hover:border-gray-1000"
          >
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
          </button>
        )}
        <div
          className={cn(
            "rounded-2xl bg-[linear-gradient(140deg,rgb(200_241_53/0.6),var(--ds-gray-alpha-400)_32%,var(--ds-gray-alpha-400)_68%,rgb(200_241_53/0.35))] p-px shadow-[0_28px_90px_-30px_rgb(200_241_53/0.45)] transition-shadow",
            dragging && "shadow-[0_0_0_2px_var(--ds-brand),0_28px_90px_-30px_rgb(200_241_53/0.7)]",
          )}
        >
          <div className="rounded-[15px] bg-background-100/95 backdrop-blur">
            <textarea
              ref={box}
              value={text}
              onChange={(e) => (setText(e.target.value), setError(null))}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), start())}
              rows={2}
              placeholder={dragging ? "Drop it to edit your clip…" : app ? "Describe your video, paste your website or repo, or drop a clip…" : "Paste your website or GitHub repo and say what you want, or drop a clip…"}
              aria-label="Describe your video"
              className={cn("block w-full resize-none bg-transparent px-5 text-base text-gray-1000 outline-none placeholder:text-gray-900 sm:text-lg", app ? "pt-12" : "pt-4")}
            />
            <div className="flex items-center gap-2 px-3 pb-3 pt-2">
              {app ? (
                <>
                  <button
                    type="button"
                    onClick={writeIdea}
                    aria-label="Write an idea for me"
                    title="Write an idea for me"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gray-alpha-100 text-gray-1000 transition-colors hover:bg-gray-alpha-200"
                  >
                    <Sparkles className="size-4 text-brand" />
                  </button>
                  <div className="ml-auto">{recipeMenu}</div>
                  <button
                    type="submit"
                    aria-label={cta}
                    title={cta}
                    disabled={busy}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-[background-color,box-shadow] hover:bg-brand-hover hover:shadow-neon disabled:opacity-60"
                  >
                    {starting ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => file.current?.click()}
                    aria-label="Add a clip you recorded"
                    title="Add a clip you recorded"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-gray-alpha-400 text-gray-1000 transition-colors hover:border-gray-1000"
                  >
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  </button>
                  {recipeMenu}
                  <button
                    type="submit"
                    className="ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-ink shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-[background-color,box-shadow] hover:bg-brand-hover hover:shadow-neon"
                  >
                    <span className="hidden sm:inline">{cta}</span>
                    <ArrowRight className="size-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {problem ? (
          <p role="alert" className="mt-2 px-2 text-[13px] text-red-900">
            {problem}
          </p>
        ) : (
          app && (
            // What Enter does, before it's pressed; then how far it's got.
            <p className="mt-2 px-2 text-[12px] text-gray-900" aria-live="polite">
              {reel.phase === "uploading" && reel.picked
                ? `Uploading your clip… ${Math.floor((reel.sent / reel.picked.file.size) * 100)}%`
                : reel.phase === "starting" || starting
                  ? demo
                    ? "Opening your clip in the editor…"
                    : "Starting it, and opening the editor…"
                  : reel.measuring
                    ? "Reading your clip…"
                    : demo
                      ? "Demo: a clip opens in the editor right away, straight from your computer. A website needs the full stack."
                      : "Enter starts your video and opens the editor. It spends the video's credits, and you confirm you own the product or clip, or may promote it."}
            </p>
          )
        )}
      </form>

      {/* The app's chips stay on one line under the box, scrolling sideways and fading at the edge. */}
      {shortcuts && (
      <div
        className={cn("mt-4 flex gap-2", app ? "overflow-x-auto [mask-image:linear-gradient(to_right,black_88%,transparent)] [scrollbar-width:none]" : "flex-wrap justify-center")}
        role="group"
        aria-label={app ? "Templates" : "Recipes"}
      >
        {SHORTCUTS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRecipe((id) => (id === r.id ? null : r.id))}
            aria-pressed={recipe === r.id}
            title={r.pitch}
            className={cn(
              "shrink-0 rounded-full border text-[13px] transition-colors",
              app ? "h-9 px-3.5" : "h-8 px-3",
              recipe === r.id
                ? "border-brand/60 bg-brand/10 font-medium text-gray-1000"
                : app
                  ? "border-transparent bg-gray-alpha-200 font-medium text-gray-1000 hover:bg-gray-alpha-300"
                  : "border-gray-alpha-400 bg-background-100/60 text-gray-900 hover:border-gray-alpha-500 hover:text-gray-1000",
            )}
          >
            {r.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => file.current?.click()}
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border text-[13px] transition-colors",
            app ? "h-9 border-transparent bg-gray-alpha-200 px-3.5 font-medium text-gray-1000 hover:bg-gray-alpha-300" : "h-8 border-gray-alpha-400 bg-background-100/60 px-3 text-gray-900 hover:border-gray-alpha-500 hover:text-gray-1000",
          )}
        >
          <Film className="size-3.5" /> Edit my clip
        </button>
      </div>
      )}
    </div>
  );
}
