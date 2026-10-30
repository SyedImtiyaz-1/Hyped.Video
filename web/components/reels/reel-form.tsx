"use client";
import { ArrowRight, Film, LoaderCircle, Upload, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { REEL_DEFAULTS, REEL_LANGUAGES, REEL_MAX_BYTES, REEL_MAX_SECONDS, REEL_SECONDS_PER_CREDIT, type ReelLanguage, type ReelOptions } from "@launchreel/core/reel";
import { REEL_CLEANUPS, type ReelCleanup } from "@launchreel/core/trims";
import { EDIT_STYLES, isEditStyle } from "@launchreel/core/edit-styles";
import { takePendingClip } from "@/lib/pending-clip";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { REEL_LANGUAGE_LABEL } from "./labels";
import { EditStylePicker } from "./edit-style-picker";
import { FontPicker } from "./font-picker";
import { LookEditor } from "./look-editor";
import { StylePicker } from "./style-picker";
import { megabytes, minutes, shape, useReelUpload } from "./use-reel-upload";

const EXTRAS: { key: "emojis" | "zooms" | "sfx" | "hook" | "broll"; label: string; hint: string }[] = [
  { key: "emojis", label: "Emojis", hint: "One on a line where it fits" },
  { key: "zooms", label: "Zooms", hint: "Punch-ins on the key moments" },
  { key: "sfx", label: "Sound effects", hint: "Soft hits and whooshes under your voice" },
  { key: "hook", label: "Hook title", hint: "A big title for the first 2.5 seconds" },
  { key: "broll", label: "Stock B-roll", hint: "Short stock clips over your talk where they fit" },
];

const CLEANUP: Record<ReelCleanup, { label: string; hint: string }> = {
  off: { label: "Off", hint: "Every second stays as you recorded it." },
  pauses: { label: "Pauses", hint: "Long pauses are shortened to a natural beat." },
  full: { label: "Pauses, fillers and retakes", hint: "Also cuts the ums, false starts and the takes you said again." },
};

const LANGUAGE_HINT: Record<ReelLanguage, string> = {
  auto: "We follow the language you speak in.",
  en: "Captions in English.",
  hinglish: "Hindi and English, written in Roman script the way you'd type it. Beta.",
};

/**
 * `pending`: opened from the homepage with a clip picked there (true: it's waiting in this browser; false: it couldn't be
 * kept, so the form asks for it again). `startStyle`: the edit style to start from (picked with that clip, or a reel
 * template's).
 */
export function ReelForm({ credits, reelCredits = 0, trial, pending, startStyle }: { credits: number; reelCredits?: number; trial: boolean; pending?: boolean; startStyle?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState<ReelOptions>(REEL_DEFAULTS);
  const [owner, setOwner] = useState(false);
  const { picked, measuring, phase, sent, busy, error, setError, cost, fromReels, enough, choose, clear: unpick, start, cancel } = useReelUpload({ credits, reelCredits });

  // The edit style to start from, and a clip picked on the homepage or in a template: the file itself when it was kept.
  useEffect(() => {
    if (isEditStyle(startStyle)) setOptions((o) => ({ ...o, ...EDIT_STYLES[startStyle].options, look: { ...EDIT_STYLES[startStyle].options.look }, fonts: [...EDIT_STYLES[startStyle].options.fonts], editStyle: startStyle }));
    if (pending === undefined) return;
    if (!pending) return setError({ message: "Choose your video again: this browser couldn't keep it while you signed up." });
    void takePendingClip().then((clip) => {
      if (clip) void choose(clip.file);
      else setError({ message: "Choose your video again to start." });
    });
    // Once, when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clear() {
    unpick();
    if (input.current) input.current.value = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return setError({ message: "Choose a video to upload." });
    if (!owner) return setError({ message: "Confirm that you own this video and have permission from everyone in it." });
    void start(options);
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <div className="border-b border-gray-alpha-400 px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-gray-1000">New reel</h2>
          <p className="mt-0.5 text-sm text-gray-900">Upload a video you recorded, up to {REEL_MAX_SECONDS / 60} minutes. You get it back with the dead air cut, captioned, with zooms and sound.</p>
        </div>

        <CardContent className="space-y-6">
          <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => choose(e.target.files?.[0])} />
          {picked ? (
            <div className="flex items-center gap-3 rounded-lg border border-gray-alpha-400 p-3">
              <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-alpha-400 bg-black text-gray-700">
                {picked.info.playable ? <video src={picked.url} muted playsInline preload="metadata" className="size-full object-cover" aria-hidden /> : <Film className="size-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-1000">{picked.file.name}</p>
                <p className="mt-0.5 text-[13px] tabular-nums text-gray-900">{[minutes(picked.info.duration), shape(picked.info), megabytes(picked.file.size)].filter(Boolean).join(" · ")}</p>
              </div>
              <Button type="button" size="sm" variant="tertiary" onClick={clear} disabled={busy} aria-label="Remove this video">
                <X />
                <span className="hidden sm:inline">Change</span>
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void choose(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-10 text-center transition-colors",
                dragging ? "border-gray-1000 bg-gray-alpha-100" : "border-gray-alpha-500 bg-background-200 hover:border-gray-alpha-600",
              )}
            >
              <span className="mb-3 flex size-11 items-center justify-center rounded-full border border-gray-alpha-400 bg-background-100 text-gray-900 [&_svg]:size-5">
                {measuring ? <LoaderCircle className="animate-spin" /> : <Upload />}
              </span>
              <span className="text-sm font-medium text-gray-1000">{measuring ? "Reading your video…" : "Drop your video here, or choose a file"}</span>
              <span className="mt-1 text-[13px] text-gray-900">
                MP4, MOV or WebM · up to {REEL_MAX_SECONDS / 60} minutes and {megabytes(REEL_MAX_BYTES)}
              </span>
            </button>
          )}

          <div>
            <Label>Edit style</Label>
            <EditStylePicker
              value={options.editStyle}
              strength={options.strength}
              onChange={(editStyle) => setOptions((o) => ({ ...o, ...EDIT_STYLES[editStyle].options, look: { ...EDIT_STYLES[editStyle].options.look }, fonts: [...EDIT_STYLES[editStyle].options.fonts], editStyle }))}
              onStrength={(strength) => setOptions((o) => ({ ...o, strength }))}
            />
          </div>

          <div>
            <Label>Clean up</Label>
            <div className="flex w-full flex-col gap-0.5 rounded-md border border-gray-alpha-400 bg-background-100 p-1 sm:inline-flex sm:h-10 sm:w-auto sm:flex-row" role="radiogroup" aria-label="Clean up">
              {REEL_CLEANUPS.map((cleanup) => (
                <button
                  key={cleanup}
                  type="button"
                  role="radio"
                  aria-checked={options.cleanup === cleanup}
                  onClick={() => setOptions((o) => ({ ...o, cleanup }))}
                  className={cn("h-9 rounded px-3 text-left text-sm transition-colors sm:h-full sm:text-center", options.cleanup === cleanup ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000")}
                >
                  {CLEANUP[cleanup].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-gray-900">{CLEANUP[options.cleanup].hint} You can put any cut back in the editor.</p>
          </div>

          <div>
            <Label>Caption style</Label>
            <StylePicker value={options.style} onChange={(style) => setOptions((o) => ({ ...o, style }))} changes={options.look} />
          </div>

          {options.style === "behind" && (
            <div>
              <Label>Big words font</Label>
              <FontPicker value={options.fonts} onChange={(fonts) => setOptions((o) => ({ ...o, fonts }))} />
            </div>
          )}

          <div>
            <Label>Customize</Label>
            <LookEditor style={options.style} changes={options.look} onChange={(update) => setOptions((o) => ({ ...o, look: update(o.look) }))} fonts={options.fonts} />
          </div>

          <div>
            <Label>Extras</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXTRAS.map((x) => {
                // "Behind you" has no emojis: its big words carry the emphasis (runner/src/reel.ts).
                const off = x.key === "emojis" && options.style === "behind";
                return (
                <label
                  key={x.key}
                  className={cn("flex items-start gap-3 rounded-lg border border-gray-alpha-400 p-3 text-sm transition-colors", off ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-gray-alpha-100")}
                >
                  <input type="checkbox" disabled={off} checked={off ? false : options[x.key]} onChange={(e) => setOptions((o) => ({ ...o, [x.key]: e.target.checked }))} className="mt-0.5 size-4 shrink-0 accent-[var(--ds-gray-1000)]" />
                  <span className="min-w-0">
                    <span className="block font-medium text-gray-1000">{x.label}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-gray-900">{off ? "Off with Behind you: the big words do the emphasis" : x.hint}</span>
                  </span>
                </label>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Language</Label>
            <div className="flex h-11 w-full items-center gap-0.5 rounded-md border border-gray-alpha-400 bg-background-100 p-1 sm:inline-flex sm:h-10 sm:w-auto" role="radiogroup" aria-label="Language">
              {REEL_LANGUAGES.map((language) => (
                <button
                  key={language}
                  type="button"
                  role="radio"
                  aria-checked={options.language === language}
                  onClick={() => setOptions((o) => ({ ...o, language }))}
                  className={cn(
                    "h-full flex-1 rounded px-2 text-sm transition-colors sm:flex-none sm:px-4",
                    options.language === language ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000",
                  )}
                >
                  {REEL_LANGUAGE_LABEL[language]}
                  {language === "hinglish" && <span className="ml-1 text-[11px] text-gray-900">beta</span>}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-gray-900">{LANGUAGE_HINT[options.language]}</p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" checked={owner} onChange={(e) => setOwner(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--ds-gray-1000)]" />
            <span className="text-gray-1000">
              I own this video and have permission from everyone in it.
              <span className="block text-[13px] text-gray-900">1 credit per {REEL_SECONDS_PER_CREDIT} seconds of video, priced before you start.{trial ? " Free-trial reels carry a small “Made with Hyped” mark." : ""}</span>
            </span>
          </label>
        </CardContent>

        {/* Like the video wizard: on phones the action stays in view above the bottom navigation. */}
        <div className="sticky bottom-[5.25rem] z-20 rounded-b-xl border-t border-gray-alpha-400 bg-background-100/95 shadow-[0_-10px_24px_-16px_rgb(0_0_0/0.35)] backdrop-blur md:static md:bg-background-100 md:shadow-none md:backdrop-blur-none">
          {phase === "uploading" && picked && (
            <div className="space-y-1.5 px-5 pt-4" aria-live="polite">
              <Progress value={sent / picked.file.size} />
              <p className="text-[13px] tabular-nums text-gray-900">
                Uploading {Math.floor((sent / picked.file.size) * 100)}% · {megabytes(sent)} of {megabytes(picked.file.size)}
              </p>
            </div>
          )}
          {error && (
            <div className="px-5 pt-3 text-[13px] text-red-900" role="alert">
              {error.message}
              {error.upgrade && (
                <>
                  {" "}
                  <Link href="/dashboard/billing" className="underline underline-offset-2">
                    Get more credits
                  </Link>
                </>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <span className={cn("text-[13px] tabular-nums", enough ? "text-gray-900" : "text-amber-900")}>
              {cost === null ? `1 credit per ${REEL_SECONDS_PER_CREDIT} s` : plural(cost, fromReels ? "reel credit" : "credit")}
              <span className="hidden sm:inline"> · you have {fromReels || (cost === null && reelCredits > 0) ? plural(reelCredits, "reel credit") : credits}</span>
            </span>
            <div className="flex items-center gap-2">
              {phase === "uploading" && (
                <Button type="button" onClick={cancel}>
                  Cancel
                </Button>
              )}
              {enough ? (
                <Button type="submit" variant="primary" disabled={busy || measuring}>
                  {phase === "uploading" ? "Uploading…" : phase === "starting" ? "Starting…" : "Make reel"}
                  {!busy && <ArrowRight />}
                </Button>
              ) : (
                <ButtonLink href="/dashboard/billing#reels" variant="primary">
                  Get reels
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
      </Card>
    </form>
  );
}
