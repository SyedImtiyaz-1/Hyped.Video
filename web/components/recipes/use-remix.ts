"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MusicChoice, Quality } from "@launchreel/core/contract";
import { creditsFor } from "@launchreel/core/pricing";
import type { Recipe } from "@launchreel/core/recipes";
import type { VoiceId } from "@launchreel/core/voices";
import { LENGTHS } from "@/app/dashboard/new/new-video-form";
import { normalizeSourceUrl } from "@/lib/source-url";

export type RemixStory = NonNullable<Recipe["video"]>;
export type RemixError = { message: string; upgrade?: boolean; token?: boolean };

/**
 * A recipe's choices and its Remix, shared by the recipe's page and its modal. Remix posts to /api/jobs exactly as the
 * step-by-step form does, with the recipe's choices filled in, then opens the new video. Private repos need a token,
 * which only that form saves.
 */
export function useRemix({
  recipe: r,
  story,
  credits,
  studioAvailable,
  initial,
}: {
  recipe: Recipe;
  story: RemixStory;
  credits: number;
  studioAvailable: boolean;
  initial: { url?: string; notes?: string; format?: Recipe["format"] };
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initial.url ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [format, setFormat] = useState(initial.format && r.formats.includes(initial.format) ? initial.format : r.format);
  const [duration, setDuration] = useState(r.durationSec);
  const [quality, setQuality] = useState<Quality>(r.tier === "studio" && studioAvailable ? "studio" : "standard");
  const [voice, setVoice] = useState<VoiceId | null>(story.voice);
  const [music, setMusic] = useState<MusicChoice>(story.music);
  const [tone, setTone] = useState(story.tone);
  const [captions, setCaptions] = useState(true);
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RemixError | null>(null);

  const lengths = [...new Set([...LENGTHS, r.durationSec])].filter((s) => s >= r.durations[0] && s <= r.durations[1]).sort((a, b) => a - b);
  const cost = creditsFor("newVideo", duration, quality);
  const fullForm = (sourceUrl = url) => `/dashboard/new?${new URLSearchParams({ template: r.id, ...(sourceUrl.trim() ? { url: sourceUrl.trim() } : {}) })}`;

  async function remix(e: React.FormEvent) {
    e.preventDefault();
    const sourceUrl = normalizeSourceUrl(url);
    if (!sourceUrl) return setError({ message: "Enter your website or a GitHub repo, like myapp.com or github.com/you/app." });
    if (!owner) return setError({ message: "Confirm that you own this product or may promote it." });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl,
          tone: tone || undefined,
          format,
          durationSec: duration,
          notes: notes.trim() || undefined,
          videoType: story.videoType,
          music,
          quality,
          voice,
          captions,
          template: r.id,
          ownershipConfirmed: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      // A repo GitHub doesn't show publicly needs a token, which the step-by-step form encrypts and saves.
      if (!res.ok) return setError({ message: data.error ?? "Could not start the video", upgrade: data.upgrade, token: res.status === 422 && /github\.com\//i.test(sourceUrl) });
      router.push(`/dashboard/videos/${data.id}`);
    } catch {
      setError({ message: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return {
    url,
    setUrl,
    notes,
    setNotes,
    format,
    setFormat,
    duration,
    setDuration,
    quality,
    setQuality,
    voice,
    setVoice,
    music,
    setMusic,
    tone,
    setTone,
    captions,
    setCaptions,
    owner,
    setOwner,
    busy,
    error,
    setError,
    lengths,
    cost,
    short: cost > credits,
    fullForm,
    remix,
  };
}
