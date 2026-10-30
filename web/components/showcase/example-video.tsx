"use client";
import { Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { posterSrc, videoSrc, type ShowcaseVideo } from "@/lib/showcase";

// In a card, each video keeps its own shape inside the 16:10 stage, like the template storyboards.
const SHAPE: Record<ShowcaseVideo["format"], string> = {
  landscape: "aspect-video w-full",
  vertical: "aspect-[9/16] h-full",
  square: "aspect-square h-full",
};

// Watching: as large as the window allows.
const WATCH: Record<ShowcaseVideo["format"], string> = {
  landscape: "aspect-video w-[min(92vw,1100px)] max-h-[86vh]",
  vertical: "aspect-[9/16] h-[min(86vh,820px)] max-w-[92vw]",
  square: "aspect-square h-[min(86vh,720px)] max-w-[92vw]",
};

/**
 * A finished video: its poster, a silent preview while the mouse is over it, and the whole video with sound in a
 * dialog on click or tap. Nothing but the poster loads until someone asks for the video. `className` resizes the tile
 * (a gallery column gives it its width, where a card's stage gives it its height).
 */
export function ExampleVideo({ video, label, className }: { video: ShowcaseVideo; label: string; className?: string }) {
  const [preview, setPreview] = useState(false);
  const [shown, setShown] = useState(false); // the preview is playing, so it can fade in over the poster
  const dialog = useRef<HTMLDialogElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const poster = useRef<HTMLImageElement>(null);

  // A poster that failed before hydration never reaches onError; hide it the same way once the page is live.
  useEffect(() => {
    const img = poster.current;
    if (img?.complete && img.naturalWidth === 0) img.style.visibility = "hidden";
  }, []);

  // However the dialog closes (the X, a click outside, Esc), the video stops. A native listener: React's onClose
  // on <dialog> didn't fire here.
  useEffect(() => {
    const d = dialog.current;
    const pause = () => player.current?.pause();
    d?.addEventListener("close", pause);
    return () => d?.removeEventListener("close", pause);
  }, []);

  const stopPreview = () => {
    setPreview(false);
    setShown(false);
  };
  const watch = () => {
    stopPreview();
    dialog.current?.showModal();
    const v = player.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {}); // the controls are there if the browser says no
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={watch}
        onPointerEnter={(e) => e.pointerType === "mouse" && setPreview(true)}
        onPointerLeave={stopPreview}
        aria-label={`Watch ${label}`}
        className={cn("relative overflow-hidden rounded-lg border border-gray-alpha-400 bg-black", SHAPE[video.format], className)}
      >
        {/* A poster that can't load is hidden rather than shown as a broken image; the tile stays, black, with its play button. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={poster} src={posterSrc(video)} alt="" loading="lazy" decoding="async" onError={(e) => (e.currentTarget.style.visibility = "hidden")} className="absolute inset-0 size-full object-cover" />
        {preview && (
          <video
            src={videoSrc(video)}
            autoPlay
            muted
            loop
            playsInline
            onPlaying={() => setShown(true)}
            className={cn("absolute inset-0 size-full object-cover transition-opacity duration-300", shown ? "opacity-100" : "opacity-0")}
          />
        )}
        <span className={cn("absolute inset-0 flex items-center justify-center transition-opacity duration-300", shown && "opacity-0")}>
          <span className="flex size-11 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/20 backdrop-blur-sm">
            <Play className="size-4 translate-x-px" fill="currentColor" />
          </span>
        </span>
      </button>

      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        aria-label={label}
        className="m-auto max-h-none max-w-none overflow-visible bg-transparent p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm"
      >
        <div className="relative">
          <video ref={player} src={videoSrc(video)} poster={posterSrc(video)} controls playsInline preload="none" className={cn("block rounded-lg bg-black", WATCH[video.format])} />
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="absolute -top-11 right-0 flex size-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors hover:bg-white/20"
          >
            <X className="size-4" />
          </button>
        </div>
      </dialog>
    </>
  );
}
