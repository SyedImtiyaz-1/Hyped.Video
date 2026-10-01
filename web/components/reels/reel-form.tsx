"use client";
import { ArrowRight, Film, LoaderCircle, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { creditsForReel, REEL_DEFAULTS, REEL_LANGUAGES, REEL_MAX_BYTES, REEL_MAX_SECONDS, REEL_UPLOAD_TYPES, type ReelLanguage, type ReelOptions, type ReelUploadType } from "@launchreel/core/reel";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { REEL_LANGUAGE_LABEL } from "./labels";
import { measureVideo, type VideoInfo } from "./measure";
import { FontPicker } from "./font-picker";
import { StylePicker } from "./style-picker";
import { uploadVideo, type Uploaded, type UploadJob } from "./upload";

const EXTRAS: { key: "emojis" | "zooms" | "sfx" | "hook"; label: string; hint: string }[] = [
  { key: "emojis", label: "Emojis", hint: "One on a line where it fits" },
  { key: "zooms", label: "Zooms", hint: "Punch-ins on the key moments" },
  { key: "sfx", label: "Sound effects", hint: "Soft hits under your voice. No music." },
  { key: "hook", label: "Hook title", hint: "A big title for the first 2.5 seconds" },
];

const LANGUAGE_HINT: Record<ReelLanguage, string> = {
  auto: "We follow the language you speak in.",
  en: "Captions in English.",
  hinglish: "Hindi and English, written in Roman script the way you'd type it. Beta.",
};

/** The upload's type from the browser, or from the file name when the browser doesn't say (common for .mov). */
function uploadType(file: File): ReelUploadType | null {
  const type = file.type.toLowerCase();
  if (type in REEL_UPLOAD_TYPES) return type as ReelUploadType;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (type === "video/x-m4v" || ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "mov" || ext === "qt") return "video/quicktime";
  return ext === "webm" ? "video/webm" : null;
}

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const megabytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`;
const shape = (info: VideoInfo) => (!info.width || !info.height ? null : info.height > info.width * 1.15 ? "9:16" : info.width > info.height * 1.15 ? "16:9" : "1:1");

type Picked = { file: File; type: ReelUploadType; info: VideoInfo; url: string };

export function ReelForm({ credits, trial }: { credits: number; trial: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const upload = useRef<UploadJob | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [options, setOptions] = useState<ReelOptions>(REEL_DEFAULTS);
  const [owner, setOwner] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "starting">("idle");
  const [sent, setSent] = useState(0);
  // Kept after an upload, so fixing a problem (like buying credits) doesn't mean uploading again.
  const [uploaded, setUploaded] = useState<{ file: File; result: Uploaded } | null>(null);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const cost = picked ? creditsForReel(picked.info.duration) : null;
  const busy = phase !== "idle";
  const enough = cost === null || credits >= cost;

  useEffect(() => () => upload.current?.cancel(), []);
  useEffect(() => () => void (picked && URL.revokeObjectURL(picked.url)), [picked]);

  async function choose(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    const type = uploadType(file);
    if (!type) return setError({ message: "Upload an MP4, MOV or WebM video." });
    if (file.size > REEL_MAX_BYTES) return setError({ message: `That file is ${megabytes(file.size)}. Videos can be up to ${megabytes(REEL_MAX_BYTES)}.` });
    setMeasuring(true);
    try {
      const info = await measureVideo(file);
      if (info.duration > REEL_MAX_SECONDS) return setError({ message: `That video is ${minutes(info.duration)} long. Reels can be up to ${REEL_MAX_SECONDS / 60} minutes: trim it and upload it again.` });
      if (info.playable && (!info.width || !info.height)) return setError({ message: "That file has sound but no picture. Upload a video." });
      setPicked({ file, type, info, url: URL.createObjectURL(file) });
    } catch (err) {
      setError({ message: (err as Error).message });
    } finally {
      setMeasuring(false);
    }
  }

  function clear() {
    setPicked(null);
    setError(null);
    if (input.current) input.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return setError({ message: "Choose a video to upload." });
    if (!owner) return setError({ message: "Confirm that you own this video and have permission from everyone in it." });
    setError(null);
    try {
      let result = uploaded?.file === picked.file ? uploaded.result : null;
      if (!result) {
        setPhase("uploading");
        setSent(0);
        upload.current = uploadVideo(picked.file, picked.type, setSent);
        result = await upload.current.done;
        setUploaded({ file: picked.file, result });
      }
      setPhase("starting");
      const res = await fetch("/api/reels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: result.key, fileName: picked.file.name, durationSec: picked.info.duration, width: picked.info.width, height: picked.info.height, ...options, ownershipConfirmed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) setUploaded(null); // the upload is gone: send it again next time
        return setError({ message: data.error ?? "Could not start the reel", upgrade: data.upgrade });
      }
      router.push(`/dashboard/videos/${data.id}`);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError({ message: (err as Error).message || "Network error. Try again." }); // cancelled: nothing to say
    } finally {
      upload.current = null;
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={submit}>
      <Card>
        <div className="border-b border-gray-alpha-400 px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-gray-1000">New reel</h2>
          <p className="mt-0.5 text-sm text-gray-900">Upload a video you recorded, up to {REEL_MAX_SECONDS / 60} minutes. You get it back captioned, with zooms and sound.</p>
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
            <Label>Caption style</Label>
            <StylePicker value={options.style} onChange={(style) => setOptions((o) => ({ ...o, style }))} />
          </div>

          {options.style === "behind" && (
            <div>
              <Label>Font</Label>
              <FontPicker value={options.fonts} onChange={(fonts) => setOptions((o) => ({ ...o, fonts }))} />
            </div>
          )}

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
              <span className="block text-[13px] text-gray-900">1 credit up to 90 seconds, 2 up to 3 minutes.{trial ? " Free-trial reels carry a small “Made with Hyped” mark." : ""}</span>
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
              {cost ? plural(cost, "credit") : "1–2 credits"}
              <span className="hidden sm:inline"> · you have {credits}</span>
            </span>
            <div className="flex items-center gap-2">
              {phase === "uploading" && (
                <Button type="button" onClick={() => upload.current?.cancel()}>
                  Cancel
                </Button>
              )}
              {enough ? (
                <Button type="submit" variant="primary" disabled={busy || measuring}>
                  {phase === "uploading" ? "Uploading…" : phase === "starting" ? "Starting…" : "Make reel"}
                  {!busy && <ArrowRight />}
                </Button>
              ) : (
                <ButtonLink href="/dashboard/billing" variant="primary">
                  Get credits
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
      </Card>
    </form>
  );
}
