"use client";
import { useEffect, useRef } from "react";
import { BROLL_FADE, brollAt, type BrollShot } from "@launchreel/core/broll";

/**
 * The B-roll on the preview, as the render lays it: the shot on screen at `time` (the cut clock) filling the frame,
 * fading in and out, muted, in step with the reel. It goes over the speaker's moves and under the picture's look, so it
 * takes the filter and the effects but not the punch-ins. The next shot loads behind it, so it starts on time.
 */
export function BrollLayer({ shots, time, playing, filter }: { shots: readonly BrollShot[]; time: number; playing: boolean; filter?: string }) {
  const now = brollAt(shots, time);
  const next = shots.findIndex((s) => s.at > time);
  return (
    <>
      {[...new Set([now, next])]
        .filter((i) => i >= 0)
        .map((i) => (
          <BrollVideo key={`${shots[i].clip.id}-${shots[i].at}`} shot={shots[i]} time={time} on={i === now} playing={playing} filter={filter} />
        ))}
    </>
  );
}

function BrollVideo({ shot, time, on, playing, filter }: { shot: BrollShot; time: number; on: boolean; playing: boolean; filter?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const offset = Math.min(shot.length, Math.max(0, time - shot.at));
  // Playing, it plays along and is put back when it drifts; paused, it shows the exact frame.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (!on || !playing) {
      if (!v.paused) v.pause();
      if (on && Math.abs(v.currentTime - offset) > 0.03) v.currentTime = offset;
      return;
    }
    if (v.paused) void v.play().catch(() => {});
    if (Math.abs(v.currentTime - offset) > 0.25) v.currentTime = offset;
  });
  const opacity = on ? Math.max(0, Math.min(1, offset / BROLL_FADE, (shot.length - offset) / BROLL_FADE)) : 0;
  return <video ref={ref} src={shot.clip.file} muted playsInline preload="auto" aria-hidden className="pointer-events-none absolute inset-0 size-full object-cover" style={{ opacity, filter }} />;
}
