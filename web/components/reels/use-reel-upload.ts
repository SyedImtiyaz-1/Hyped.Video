"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { creditsForReel, REEL_MAX_BYTES, REEL_MAX_SECONDS, REEL_UPLOAD_TYPES, type ReelOptions, type ReelUploadType } from "@launchreel/core/reel";
import { measureVideo, type VideoInfo } from "./measure";
import { uploadVideo, type Uploaded, type UploadJob } from "./upload";

/** The upload's type from the browser, or from the file name when the browser doesn't say (common for .mov). */
function uploadType(file: File): ReelUploadType | null {
  const type = file.type.toLowerCase();
  if (type in REEL_UPLOAD_TYPES) return type as ReelUploadType;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (type === "video/x-m4v" || ext === "mp4" || ext === "m4v") return "video/mp4";
  if (ext === "mov" || ext === "qt") return "video/quicktime";
  return ext === "webm" ? "video/webm" : null;
}

export const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const megabytes = (bytes: number) => (bytes >= 1024 ** 3 ? `${Math.round((bytes / 1024 ** 3) * 10) / 10} GB` : `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`);
export const shape = (info: VideoInfo) => (!info.width || !info.height ? null : info.height > info.width * 1.15 ? "9:16" : info.width > info.height * 1.15 ? "16:9" : "1:1");

export type Picked = { file: File; type: ReelUploadType; info: VideoInfo; url: string };

/**
 * A clip of the customer's, made into a reel: checked and measured when picked, priced, uploaded in parts, then started
 * with the given options (POST /api/reels) and the editor opened, where its first cut is being made. Shared by the reel
 * form, the reel templates' modal and the prompt box (which picks and starts at once: `choose` hands back the clip). An
 * upload is kept once it's done, so fixing a problem (like buying credits) doesn't mean sending it again. Without the
 * balances, the server alone says whether there are enough credits.
 */
export function useReelUpload({ credits = Infinity, reelCredits = 0 }: { credits?: number; reelCredits?: number } = {}) {
  const router = useRouter();
  const upload = useRef<UploadJob | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "starting">("idle");
  const [sent, setSent] = useState(0);
  const [uploaded, setUploaded] = useState<{ file: File; result: Uploaded } | null>(null);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const cost = picked ? creditsForReel(picked.info.duration) : null;
  const busy = phase !== "idle";
  // Reel credits (from a reel pack) pay first, then credits, as /api/reels charges.
  const fromReels = cost !== null && reelCredits >= cost;
  const enough = cost === null || fromReels || credits >= cost;

  useEffect(() => () => upload.current?.cancel(), []);
  useEffect(() => () => void (picked && URL.revokeObjectURL(picked.url)), [picked]);

  async function choose(file: File | undefined): Promise<Picked | null> {
    if (!file || busy) return null;
    setError(null);
    const fail = (message: string) => (setError({ message }), null);
    const type = uploadType(file);
    if (!type) return fail("Upload an MP4, MOV or WebM video.");
    if (file.size > REEL_MAX_BYTES) return fail(`That file is ${megabytes(file.size)}. Videos can be up to ${megabytes(REEL_MAX_BYTES)}.`);
    setMeasuring(true);
    try {
      const info = await measureVideo(file);
      if (info.duration > REEL_MAX_SECONDS) return fail(`That video is ${minutes(info.duration)} long. Videos can be up to ${REEL_MAX_SECONDS / 60} minutes: trim it and upload it again.`);
      if (info.playable && (!info.width || !info.height)) return fail("That file has sound but no picture. Upload a video.");
      const chosen = { file, type, info, url: URL.createObjectURL(file) };
      setPicked(chosen);
      return chosen;
    } catch (err) {
      return fail((err as Error).message);
    } finally {
      setMeasuring(false);
    }
  }

  function clear() {
    setPicked(null);
    setError(null);
  }

  /**
   * Uploads the picked clip (unless it's already up) and starts the reel. `notes`: what to change, kept for Ask AI.
   * `chosen`: a clip `choose` just handed back, before its state has landed.
   */
  async function start(options: ReelOptions, notes?: string, chosen?: Picked) {
    const clip = chosen ?? picked;
    if (!clip) return setError({ message: "Choose a video to upload." });
    setError(null);
    try {
      let result = uploaded?.file === clip.file ? uploaded.result : null;
      if (!result) {
        setPhase("uploading");
        setSent(0);
        upload.current = uploadVideo(clip.file, clip.type, setSent);
        result = await upload.current.done;
        setUploaded({ file: clip.file, result });
      }
      setPhase("starting");
      const res = await fetch("/api/reels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: result.key,
          fileName: clip.file.name,
          durationSec: clip.info.duration,
          width: clip.info.width,
          height: clip.info.height,
          ...options,
          notes: notes?.trim() || undefined,
          ownershipConfirmed: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) setUploaded(null); // the upload is gone: send it again next time
        return setError({ message: data.error ?? "Could not start the reel", upgrade: data.upgrade });
      }
      router.push(`/dashboard/videos/${data.id}/edit`);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError({ message: (err as Error).message || "Network error. Try again." }); // cancelled: nothing to say
    } finally {
      upload.current = null;
      setPhase("idle");
    }
  }

  return { picked, measuring, phase, sent, busy, error, setError, cost, fromReels, enough, choose, clear, start, cancel: () => upload.current?.cancel() };
}
