"use client";
import { ArrowRight, ChevronDown, GitBranch, Globe, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { creditsFor } from "@launchreel/core/pricing";
import { RECIPE_CATEGORIES, type Recipe } from "@launchreel/core/recipes";
import { VOICES } from "@launchreel/core/voices";
import { FORMATS, MUSIC_OPTIONS, QUALITY_OPTIONS, TONES } from "@/app/dashboard/new/new-video-form";
import { TIER_LABEL } from "@/components/recipes/labels";
import { RecipeSample, RecipeStory } from "@/components/recipes/recipe-sample";
import { useRemix, type RemixStory } from "@/components/recipes/use-remix";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { normalizeSourceUrl } from "@/lib/source-url";

/**
 * A recipe on one screen (docs/RECIPES.md): the sample and its story on the left; on the right the product to make it
 * for, "Anything to change?", shape and length, more options, the cost and Remix. The dashboard opens recipes in a
 * modal (recipe-modal.tsx); this page is for links, and for every option.
 */
export function RecipePanel({
  recipe: r,
  story,
  credits,
  initialUrl,
  initialNotes,
  studioAvailable,
}: {
  recipe: Recipe;
  story: RemixStory;
  credits: number;
  initialUrl: string;
  initialNotes: string;
  studioAvailable: boolean;
}) {
  const [more, setMore] = useState(false);
  const { url, setUrl, notes, setNotes, format, setFormat, duration, setDuration, quality, setQuality, voice, setVoice, music, setMusic, tone, setTone, captions, setCaptions, owner, setOwner, busy, error, setError, lengths, cost, short, fullForm, remix } =
    useRemix({ recipe: r, story, credits, studioAvailable, initial: { url: initialUrl, notes: initialNotes } });
  const github = /github\.com\//i.test(url);

  return (
    <form onSubmit={remix} className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-5 lg:sticky lg:top-20">
        <RecipeSample recipe={r} />
        <div>
          <h2 className="mb-2 text-sm font-semibold">The story</h2>
          <RecipeStory recipe={r} />
        </div>
      </div>

      <div className="space-y-6">
        <header>
          <p className="text-[13px] font-medium uppercase tracking-wider text-gray-900">{RECIPE_CATEGORIES.find((c) => c.value === r.category)?.label}</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-9 tracking-[-0.04em] md:text-[32px] md:leading-10">{r.name}</h1>
          <p className="mt-1 text-gray-900 md:text-base">{r.pitch}</p>
          <p className="mt-3 text-[13px] text-gray-900">
            Works best with <span className="font-medium text-gray-1000">{TIER_LABEL[r.tier]}</span> · for {r.platforms.join(", ")}
          </p>
        </header>

        <div>
          <Label htmlFor="recipe-url">{r.inputs.find((i) => i.type === "source")?.label ?? "Your website or GitHub repo"}</Label>
          <Input
            id="recipe-url"
            value={url}
            onChange={(e) => (setUrl(e.target.value), setError(null))}
            placeholder="yourproduct.com or github.com/you/app"
            prefix={github ? <GitBranch /> : <Globe />}
            autoComplete="url"
            aria-invalid={(error && !normalizeSourceUrl(url)) || undefined}
          />
          <p className="mt-1.5 text-[13px] text-gray-900">
            Any public page, or a public repo.{" "}
            <Link href={fullForm()} className="underline underline-offset-2 hover:text-gray-1000">
              Private repo?
            </Link>
          </p>
        </div>

        <div>
          <Label htmlFor="recipe-notes">
            Anything to change? <span className="font-normal">Optional</span>
          </Label>
          <Textarea id="recipe-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Fast cuts, bold type. End on the pricing page." />
        </div>

        <Choice label="Shape">
          {FORMATS.filter((f) => r.formats.includes(f.value as Recipe["format"])).map((f) => (
            <Chip key={f.value} on={format === f.value} onClick={() => setFormat(f.value as Recipe["format"])} title={f.where}>
              {f.label} <span className="text-gray-900">{f.ratio}</span>
            </Chip>
          ))}
        </Choice>

        <Choice label="Length">
          {lengths.map((s) => (
            <Chip key={s} on={duration === s} onClick={() => setDuration(s)} title={plural(creditsFor("newVideo", s, quality), "credit")}>
              <span className="tabular-nums">{s}s</span>
            </Chip>
          ))}
        </Choice>

        <div className="rounded-xl border border-gray-alpha-400">
          <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium">
            More options
            <ChevronDown className={cn("size-4 text-gray-900 transition-transform", more && "rotate-180")} />
          </button>
          {more && (
            <div className="space-y-5 border-t border-gray-alpha-400 px-4 py-4">
              <Choice label="Voiceover">
                <Chip on={voice === null} onClick={() => setVoice(null)}>
                  No voice
                </Chip>
                {VOICES.map((v) => (
                  <Chip key={v.id} on={voice === v.id} onClick={() => setVoice(v.id)} title={`${v.style} · ${v.accent}`}>
                    {v.name}
                  </Chip>
                ))}
              </Choice>
              {voice && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} className="size-4 accent-[var(--ds-gray-1000)]" />
                  Burn the captions into the video (you get an SRT file either way)
                </label>
              )}
              <Choice label="Music">
                {MUSIC_OPTIONS.map((m) => (
                  <Chip key={m.value} on={music === m.value} onClick={() => setMusic(m.value)} title={m.hint}>
                    {m.label}
                  </Chip>
                ))}
              </Choice>
              <div>
                <Label htmlFor="recipe-tone">Tone</Label>
                <select
                  id="recipe-tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="h-10 w-full rounded-md border border-gray-alpha-400 bg-background-100 px-3 text-sm text-gray-1000 hover:border-gray-alpha-500"
                >
                  {TONES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} · {t.hint}
                    </option>
                  ))}
                </select>
              </div>
              <Choice label="Quality">
                {QUALITY_OPTIONS.map((q) => {
                  const soon = q.value === "studio" && !studioAvailable;
                  return (
                    <Chip key={q.value} on={quality === q.value} onClick={() => !soon && setQuality(q.value)} disabled={soon} title={soon ? "Coming soon" : q.hint}>
                      {q.label}
                      <span className="text-gray-900">{soon ? "Soon" : plural(creditsFor("newVideo", duration, q.value), "credit")}</span>
                    </Chip>
                  );
                })}
              </Choice>
            </div>
          )}
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={owner} onChange={(e) => (setOwner(e.target.checked), setError(null))} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
          <span className="text-gray-1000">
            I own this product or I&apos;m authorized to promote it.
            <span className="block text-[13px] text-gray-900">Videos show your product&apos;s UI and copy only: no real people, no cloned voices.</span>
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-900">
            {error.message}{" "}
            {error.upgrade && (
              <Link href="/dashboard/billing" className="font-medium underline underline-offset-2">
                Buy credits
              </Link>
            )}
            {error.token && (
              <Link href={fullForm(normalizeSourceUrl(url) ?? url)} className="font-medium underline underline-offset-2">
                Add a token in the step-by-step form
              </Link>
            )}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-gray-alpha-400 pt-5">
          <p className="text-sm">
            <span className="font-medium tabular-nums">{plural(cost, "credit")}</span>
            <span className="text-gray-900"> · you have {credits}</span>
          </p>
          {short ? (
            <ButtonLink href="/dashboard/billing" variant="primary">
              Buy credits
            </ButtonLink>
          ) : (
            <Button type="submit" variant="primary" disabled={busy}>
              {busy && <LoaderCircle className="animate-spin" />}
              Remix <ArrowRight />
            </Button>
          )}
        </div>
        <p className="text-[13px] text-gray-900">
          Want to write the full brief (what&apos;s new, who it&apos;s for, what to show)?{" "}
          <Link href={fullForm()} className="underline underline-offset-2 hover:text-gray-1000">
            Open the step-by-step form
          </Link>
        </p>
      </div>
    </form>
  );
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-gray-900">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {children}
      </div>
    </fieldset>
  );
}

function Chip({ on, onClick, title, disabled, children }: { on: boolean; onClick: () => void; title?: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on ? "border-gray-1000 bg-gray-alpha-200 font-medium text-gray-1000" : "border-gray-alpha-400 text-gray-900 hover:border-gray-alpha-500 hover:text-gray-1000",
      )}
    >
      {children}
    </button>
  );
}
