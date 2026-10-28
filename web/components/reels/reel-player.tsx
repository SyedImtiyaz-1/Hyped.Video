"use client";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

/**
 * A finished reel's video. When it can still be edited, "Edit text" sits over the picture: it opens the editor at the
 * second the video is on, with that moment's caption ready to edit.
 */
export function ReelPlayer({ src, poster, editHref }: { src: string; poster?: string; editHref?: string }) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  return (
    <div className="group relative size-full">
      <video ref={video} src={src} poster={poster} controls playsInline preload="metadata" className="size-full" />
      {editHref && (
        <button
          type="button"
          onClick={() => {
            video.current?.pause();
            router.push(`${editHref}?t=${(video.current?.currentTime ?? 0).toFixed(2)}`);
          }}
          className="absolute left-3 top-3 flex h-8 items-center gap-1.5 rounded-full bg-black/65 px-3 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          <Pencil className="size-3.5" />
          Edit text
        </button>
      )}
    </div>
  );
}
