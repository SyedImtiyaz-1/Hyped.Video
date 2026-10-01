"use client";
import { ArrowRight, Mic, MicOff, Play, Plus, Square } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { creditsFor } from "@launchreel/core/pricing";
import { TEMPLATE_GOALS, TEMPLATES, type Template, type TemplateGoal } from "@launchreel/core/templates";
import { voiceById } from "@launchreel/core/voices";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { showcaseFor, videoSrc } from "@/lib/showcase";

const RATIO: Record<Template["format"], string> = { landscape: "16:9", vertical: "9:16", square: "1:1" };

/**
 * The template gallery: "Start blank" first, then every template, filterable by goal. Each card links to the
 * new-video steps with the template filled in, carrying the customer's URL if they already typed one.
 */
export function TemplateGallery({ url }: { url?: string }) {
  const [goal, setGoal] = useState<TemplateGoal | "all">("all");
  const shown = goal === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.goal === goal);
  const withUrl = (params: URLSearchParams) => {
    if (url) params.set("url", url);
    const q = params.toString();
    return `/dashboard/new${q ? `?${q}` : ""}`;
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by goal">
        {[{ value: "all" as const, label: "All" }, ...TEMPLATE_GOALS].map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => setGoal(g.value)}
            aria-pressed={goal === g.value}
            className={cn(
              "h-9 rounded-full border px-3.5 text-[13px] transition-colors sm:h-8",
              goal === g.value ? "border-gray-1000 bg-gray-1000 text-background-100" : "border-gray-alpha-400 text-gray-900 hover:border-gray-alpha-500 hover:text-gray-1000",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href={withUrl(new URLSearchParams())}
          className="flex min-h-[18rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-alpha-500 bg-background-100 p-6 text-center transition-colors hover:border-gray-1000"
        >
          <span className="flex size-10 items-center justify-center rounded-full border border-gray-alpha-400">
            <Plus className="size-4" />
          </span>
          <span className="text-base font-semibold">Start blank</span>
          <span className="max-w-[16rem] text-sm text-gray-900">Choose every option yourself, step by step.</span>
        </Link>
        {shown.map((t) => (
          <TemplateCard key={t.id} template={t} href={withUrl(new URLSearchParams({ template: t.id }))} />
        ))}
      </div>
    </div>
  );
}

export function TemplateCard({ template: t, href }: { template: Template; href: string }) {
  const beats = t.beats;
  const voice = voiceById(t.voice);
  // A video Hyped made with this template plays over the storyboard: on hover with a mouse, or with the button.
  const example = showcaseFor(t.id);
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
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-100 transition-colors hover:border-gray-alpha-500"
    >
      {/* A storyboard of the recipe, in its own frame shape. */}
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden border-b border-gray-alpha-400 bg-background-200 p-4">
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_30%_20%,var(--ds-gray-alpha-200),transparent_60%)]" />
        {example && (
          <button
            type="button"
            onClick={() => (preview ? stop() : setPreview(true))}
            aria-pressed={preview}
            aria-label={preview ? `Stop the ${t.name} example` : `Play an example made with ${t.name}`}
            className="absolute bottom-2 right-2 z-10 inline-flex h-7 items-center gap-1 rounded-full border border-gray-alpha-400 bg-background-100/90 px-2.5 text-[11px] font-medium text-gray-1000 backdrop-blur-sm transition-colors hover:border-gray-1000"
          >
            {preview ? <Square className="size-3" fill="currentColor" /> : <Play className="size-3" fill="currentColor" />}
            Example
          </button>
        )}
        <div
          className={cn(
            "relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100 p-3 shadow-sm",
            t.format === "landscape" ? "aspect-video w-[88%]" : t.format === "vertical" ? "aspect-[9/16] h-full" : "aspect-square h-full",
          )}
        >
          {preview && example && (
            <video
              src={videoSrc(example)}
              autoPlay
              muted
              loop
              playsInline
              onPlaying={() => setShown(true)}
              aria-label={`Example made with ${t.name}`}
              className={cn("absolute inset-0 z-10 size-full bg-black object-cover transition-opacity duration-300", shown ? "opacity-100" : "opacity-0")}
            />
          )}
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-900">{TEMPLATE_GOALS.find((g) => g.value === t.goal)?.label}</span>
          <span className={cn("mt-1 font-semibold leading-tight tracking-tight", t.format === "vertical" ? "text-sm" : "text-base")}>{t.name}</span>
          <div className="mt-auto space-y-1">
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
              {beats.map((b, i) => (
                <span key={i} title={`${b.from}-${b.to}s ${b.label}`} className={cn("h-full rounded-full", i % 2 ? "bg-gray-alpha-500" : "bg-gray-1000")} style={{ flexGrow: b.to - b.from }} />
              ))}
            </div>
            {t.format === "landscape" && <p className="truncate text-[10px] text-gray-900">{beats.map((b) => b.label).join(" → ")}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold">{t.name}</h3>
        <p className="mt-0.5 text-sm text-gray-900">{t.use}</p>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-[12px] text-gray-900">
          <li className="rounded-full border border-gray-alpha-400 px-2 py-0.5 tabular-nums">{t.durationSec}s</li>
          <li className="rounded-full border border-gray-alpha-400 px-2 py-0.5">{RATIO[t.format]}</li>
          <li className="flex items-center gap-1 rounded-full border border-gray-alpha-400 px-2 py-0.5">
            {voice ? <Mic className="size-3" /> : <MicOff className="size-3" />}
            {voice ? voice.name : "No voice"}
          </li>
          <li className="rounded-full border border-gray-alpha-400 px-2 py-0.5 tabular-nums">{plural(creditsFor("newVideo", t.durationSec), "credit")}</li>
        </ul>
        <p className="mb-4 mt-3 text-[12px] text-gray-900">For {t.platforms.join(", ")}</p>
        <Link
          href={href}
          className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gray-alpha-400 text-sm font-medium transition-colors hover:border-gray-1000 group-hover:border-gray-1000"
        >
          Use template
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
