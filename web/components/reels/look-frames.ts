// What Ask AI sees of the video (Taibanaz, 18 Nov: as Cardboard's agent "got eyes"): frames made in the browser from a
// hidden copy of the clip (seek, draw, next), small JPEGs, and with each request up to eight of them spread over the
// video as it plays, plus the one at the playhead. The model reads them at low detail (about 85 tokens a frame).
import { useEffect, useRef } from "react";
import { CHAT_FRAMES, type ChatFrame } from "@launchreel/core/reel-chat";
import { trimAt, type Trim } from "@launchreel/core/trims";

/** A frame on the recording's clock. */
export type SeenFrame = { at: number; image: string };

// The longer side of a frame, in pixels: the model's low detail looks at 512 at most.
const SIDE = 448;
// Frames along the recording: one about every 1.5 seconds, 8 to 24 of them.
const EVERY = 1.5;
const MIN = 8;
const MAX = 24;

/** The video's picture now, as a small JPEG, or null (not loaded yet, or a picture the page may not read). */
export function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement = document.createElement("canvas")): string | null {
  const { videoWidth: w, videoHeight: h } = video;
  if (!w || !h || video.readyState < 2) return null;
  const k = Math.min(1, SIDE / Math.max(w, h));
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.6);
    return image.length <= CHAT_FRAMES.chars ? image : null;
  } catch {
    return null;
  }
}

/** Frames along the clip, made once in the background (they come in one by one; none when it can't be read). */
export function useLookFrames(src: string | undefined) {
  const frames = useRef<SeenFrame[]>([]);
  useEffect(() => {
    frames.current = [];
    if (!src) return;
    let stopped = false;
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;
    video.src = src;
    const run = async () => {
      await new Promise((ok, fail) => {
        video.addEventListener("loadeddata", ok, { once: true });
        video.addEventListener("error", fail, { once: true });
      });
      const canvas = document.createElement("canvas");
      const count = Math.min(MAX, Math.max(MIN, Math.round(video.duration / EVERY)));
      for (let i = 0; i < count && !stopped; i++) {
        const at = Math.min(Math.max(0, video.duration - 0.05), ((i + 0.5) * video.duration) / count);
        video.currentTime = at;
        await new Promise((ok) => video.addEventListener("seeked", ok, { once: true }));
        const image = grabFrame(video, canvas);
        if (image && !stopped) frames.current = [...frames.current, { at, image }];
      }
    };
    run().catch(() => {});
    return () => {
      stopped = true;
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);
  return frames;
}

/**
 * The frames for one request, on the video's clock as it plays: up to `max` of those not cut out, spread evenly, and
 * the playhead's (when it could be read), marked.
 */
export function framesForAsk(made: readonly SeenFrame[], clock: { toCut: (t: number) => number }, trims: readonly Trim[], playhead: { at: number; image: string | null }, max = CHAT_FRAMES.max - 1): ChatFrame[] {
  const kept = made.filter((f) => trimAt(trims, f.at) < 0).map((f) => ({ at: clock.toCut(f.at), image: f.image }));
  const step = kept.length / Math.min(max, kept.length);
  const picked = kept.length <= max ? kept : Array.from({ length: max }, (_, i) => kept[Math.floor(i * step + step / 2)]!);
  return [...picked, ...(playhead.image ? [{ at: playhead.at, image: playhead.image, playhead: true }] : [])];
}
