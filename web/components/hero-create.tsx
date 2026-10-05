"use client";
import { ArrowRight, Film, Globe, LoaderCircle, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { EDIT_STYLES, REEL_EDIT_STYLES, type ReelEditStyle } from "@launchreel/core/edit-styles";
import { REEL_MAX_BYTES, REEL_MAX_SECONDS } from "@launchreel/core/reel";
import { cn } from "@/lib/cn";
import { savePendingClip } from "@/lib/pending-clip";
import { StartForm } from "./start-form";

type Mode = "website" | "clip";

/**
 * The homepage's create box, Captions-style: make a video from a website or repo (the URL box), or edit a clip you
 * recorded: pick it and an edit style here, sign up, and the reel form opens with both already chosen.
 */
export function HeroCreate({ className }: { className?: string }) {
  const [mode, setMode] = useState<Mode>("website");
  return (
    <div className={cn("mx-auto w-full max-w-xl", className)}>
      <div className="mb-3 inline-flex items-center gap-0.5 rounded-full border border-gray-alpha-400 bg-background-100 p-1" role="tablist" aria-label="What to make">
        {(
          [
            ["website", "Website video", Globe],
            ["clip", "Edit my clip", Film],
          ] as const
        ).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] transition-colors", mode === id ? "bg-gray-1000 font-medium text-background-100" : "text-gray-900 hover:text-gray-1000")}>
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
      {mode === "website" ? <StartForm /> : <ClipStart />}
    </div>
  );
}

function ClipStart() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [style, setStyle] = useState<ReelEditStyle>("creator");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function choose(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    if (!/^video\//.test(file.type) && !/\.(mp4|m4v|mov|webm)$/i.test(file.name)) return setError("Choose a video: MP4, MOV or WebM.");
    if (file.size > REEL_MAX_BYTES) return setError(`Videos can be up to ${Math.round(REEL_MAX_BYTES / 1024 ** 3)} GB.`);
    setBusy(true);
    // Kept in this browser through sign-up; if it can't be kept, the form asks for it again.
    const kept = await savePendingClip(file, style);
    router.push(`/dashboard/reels?pending=${kept ? 1 : 0}&style=${style}`);
  }
  return (
    <div>
      <div className="rounded-xl border border-gray-alpha-400 bg-background-100 p-2 shadow-[0_8px_40px_-12px_rgb(0_0_0/0.6)]">
        <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void choose(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void choose(e.dataTransfer.files?.[0]);
          }}
          className={cn("flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-left transition-colors", dragging ? "border-gray-1000 bg-gray-alpha-100" : "border-gray-alpha-500 hover:border-gray-alpha-600")}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gray-alpha-400 text-gray-900">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-gray-1000">{busy ? "Getting your clip ready…" : "Drop a video you recorded, or choose a file"}</span>
            <span className="block text-[13px] text-gray-900">MP4, MOV or WebM · up to {REEL_MAX_SECONDS / 60} minutes</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-gray-900" />
        </button>
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5" role="radiogroup" aria-label="Edit style">
          <span className="shrink-0 text-xs text-gray-900">Style</span>
          {REEL_EDIT_STYLES.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={style === id} title={EDIT_STYLES[id].hint} onClick={() => setStyle(id)} className={cn("h-7 shrink-0 rounded-full border px-2.5 text-xs transition-colors", style === id ? "border-gray-1000 bg-gray-alpha-200 font-medium text-gray-1000" : "border-gray-alpha-400 text-gray-900 hover:text-gray-1000")}>
              {EDIT_STYLES[id].label}
            </button>
          ))}
        </div>
      </div>
      <p className={cn("mt-2 text-[13px]", error ? "text-red-900" : "text-gray-900")} role={error ? "alert" : undefined}>
        {error ?? "Cuts the pauses and retakes, then adds captions, zooms, sound and music. Every cut can be put back."}
      </p>
    </div>
  );
}
