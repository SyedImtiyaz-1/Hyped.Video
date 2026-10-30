"use client";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ReelEditStyle } from "@launchreel/core/edit-styles";
import { ReelCover } from "@/components/recipes/recipe-tile";
import { cn } from "@/lib/cn";
import { posterSrc, SHOWCASE, videoSrc } from "@/lib/showcase";

// One tab per kind of video: its headline, the sample that shows it (or, for reels until they have samples, the reel
// style's own preview), and where to start one.
type UseCase = { label: string; headline: string; video?: string; reel?: ReelEditStyle; href: string };
const CASES: UseCase[] = [
  { label: "Launch videos", headline: "Your next launch video, from one link.", video: "cmuo53uiq000louici7g2ta4h", href: "/recipes/launch-day" },
  { label: "Product demos", headline: "Your next product demo, from one link.", video: "cmus8frei0007oufwdk6g8a85", href: "/recipes/walkthrough" },
  { label: "Feature updates", headline: "Your next feature update, from one link.", video: "cmuo53uhi0007ouicxewkq6xd", href: "/recipes/feature-drop" },
  { label: "Explainers", headline: "Your next explainer, from one link.", video: "cmus8fre70003oufwod3jw8or", href: "/recipes/three-features" },
  { label: "Ads", headline: "Your next ad, from one link.", video: "cmus8frem0009oufwfpyjq0nr", href: "/recipes/problem-solution" },
  { label: "Talking-head reels", headline: "Your next reel, from one clip.", reel: "creator", href: "/dashboard/reels?style=creator" },
  { label: "Podcast clips", headline: "Your next podcast clip, from one recording.", reel: "podcast", href: "/dashboard/reels?style=podcast" },
];

/** "Your next …": the kinds of video Hyped makes as tabs, each showing one playing, with the way to start one. */
export function UseCases() {
  const [index, setIndex] = useState(0);
  const current = CASES[index];
  const video = current.video ? SHOWCASE.find((v) => v.id === current.video) : undefined;
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-center">
      <div>
        <h2 key={current.headline} className="text-3xl font-semibold tracking-[-0.04em] motion-safe:animate-word-in md:text-5xl md:leading-[1.05]">
          {current.headline}
        </h2>
        <p className="mt-3 text-gray-900">No editor, no timeline, no stock footage.</p>
        <div role="tablist" aria-label="Kinds of video" className="mt-8 flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
          {CASES.map((c, i) => (
            <button
              key={c.label}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-left text-sm transition-colors lg:rounded-md lg:px-0 lg:py-1.5 lg:text-base",
                i === index ? "bg-gray-1000 text-background-100 lg:bg-transparent lg:font-medium lg:text-gray-1000" : "bg-gray-alpha-100 text-gray-900 hover:text-gray-1000 lg:bg-transparent",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <Link href={current.href} className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
          Make one <ArrowRight className="size-4" />
        </Link>
      </div>

      <div role="tabpanel" aria-label={current.label} className="flex aspect-[16/11] items-center justify-center overflow-hidden rounded-2xl border border-gray-alpha-400 bg-background-200 p-6 md:p-10">
        {video ? (
          <video
            key={video.id}
            src={videoSrc(video)}
            poster={posterSrc(video)}
            autoPlay
            muted
            loop
            playsInline
            aria-label={`${current.label}: a sample made with Hyped for ${video.product}`}
            className={cn("max-h-full rounded-xl bg-black shadow-2xl", video.format === "landscape" ? "w-full" : video.format === "square" ? "aspect-square h-full" : "aspect-[9/16] h-full")}
          />
        ) : current.reel ? (
          <div key={current.reel} className="aspect-[9/16] h-full overflow-hidden rounded-xl shadow-2xl">
            <ReelCover style={current.reel} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
