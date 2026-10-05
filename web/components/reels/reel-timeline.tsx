"use client";
import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CaptionLine } from "@launchreel/core/captions";
import { EFFECTS, effectSpan } from "@launchreel/core/effects";
import type { ReelEdit } from "@launchreel/core/reel";
import { REEL_SOUNDS } from "@launchreel/core/sounds";
import { emojiShows, type ZoomWindow } from "@launchreel/core/timeline";
import { cn } from "@/lib/cn";

export type TimelineItem = { kind: "line"; word: number } | { kind: "effect"; index: number } | { kind: "zoom"; word: number } | { kind: "emoji"; word: number } | { kind: "sound"; index: number } | { kind: "trim"; index: number } | { kind: "broll"; index: number };
/** A B-roll shot's span on the recording's clock (it plays straight over any cut inside it). */
export type BrollSpan = { index: number; start: number; end: number; query: string };

const TRIM_NAME = { pause: "Pause", filler: "Filler", retake: "Retake", cut: "Cut" } as const;

const LABEL = 64;
const ZOOMS = [1, 2, 4, 8];

/**
 * The reel along time, CapCut-style, on the recording's clock: a track for what's cut (hatched across every track),
 * a track each for the captions, the B-roll, the effects and punch-ins, the emojis and the sounds, the shot changes
 * marked across them, and the playhead. Click or drag anywhere to move the playhead; click a piece to go to it and edit it.
 */
export function ReelTimeline({ edit, lines, windows, broll, time, duration, showEmojis, showZooms, showSounds, onSeek, onPick }: { edit: ReelEdit; lines: CaptionLine[]; windows: ZoomWindow[]; broll: BrollSpan[]; time: number; duration: number; showEmojis: boolean; showZooms: boolean; showSounds: boolean; onSeek: (t: number) => void; onPick: (item: TimelineItem) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const resize = new ResizeObserver(() => setWidth(el.clientWidth));
    resize.observe(el);
    setWidth(el.clientWidth);
    return () => resize.disconnect();
  }, []);
  const perSecond = (Math.max(200, width - LABEL - 8) / Math.max(1, duration)) * zoom;
  const x = (t: number) => t * perSecond;
  const full = x(duration);

  // Keep the playhead in view while it plays.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const at = LABEL + x(time);
    if (at < el.scrollLeft + LABEL + 16 || at > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = Math.max(0, at - LABEL - el.clientWidth * 0.3);
    // Only when the time or the scale moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, perSecond]);

  const seeking = useRef(false);
  const timeAt = (e: ReactPointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.max(0, Math.min(duration, (e.clientX - rect.left) / perSecond));
  };
  const scrub = {
    onPointerDown: (e: ReactPointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-piece]")) return;
      seeking.current = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      onSeek(timeAt(e));
    },
    onPointerMove: (e: ReactPointerEvent) => seeking.current && onSeek(timeAt(e)),
    onPointerUp: () => (seeking.current = false),
  };

  const step = duration > 60 ? 10 : duration > 20 ? 5 : 2;
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, k) => k * step);
  const piece = (item: TimelineItem, left: number, w: number, className: string, title: string, children: React.ReactNode, top = 4) => (
    <button
      key={JSON.stringify(item)}
      type="button"
      data-piece
      title={title}
      aria-label={title}
      onClick={() => onPick(item)}
      className={cn("absolute flex h-5 items-center overflow-hidden whitespace-nowrap rounded px-1 text-[11px] leading-none", className)}
      style={{ left, width: Math.max(w, 6), top }}
    >
      {children}
    </button>
  );
  const shows = showEmojis ? emojiShows(edit, lines) : [];
  const tracks: { name: string; items: React.ReactNode[] }[] = [
    ...(edit.trims.length
      ? [
          {
            name: "Cuts",
            items: edit.trims.map((t, i) =>
              piece({ kind: "trim", index: i }, x(t.start), x(t.end) - x(t.start), "bg-red-300 text-red-1000 hover:bg-red-400", `${TRIM_NAME[t.reason]} cut, ${(t.end - t.start).toFixed(1)} s at ${t.start.toFixed(1)} s`, TRIM_NAME[t.reason]),
            ),
          },
        ]
      : []),
    {
      name: "Captions",
      items: lines.map((l, li) => piece({ kind: "line", word: l.words[0].i }, x(l.start), x(l.end) - x(l.start) - 1, "bg-gray-alpha-300 text-gray-1000 hover:bg-gray-alpha-400", l.text, l.text, 4 + (li % 2) * 0)),
    },
    ...(broll.length
      ? [{ name: "B-roll", items: broll.map((b) => piece({ kind: "broll", index: b.index }, x(b.start), x(b.end) - x(b.start) - 1, "bg-green-300 text-green-1000 hover:bg-green-400", `B-roll: ${b.query || "stock clip"} at ${b.start.toFixed(1)} s`, b.query || "B-roll")) }]
      : []),
    ...(showZooms && windows.length
      ? [{ name: "Zooms", items: windows.map((z) => piece({ kind: "zoom", word: z.word ?? 0 }, x(z.start), x(z.end + 0.45) - x(z.start), "bg-blue-300 text-blue-1000 hover:bg-blue-400", `Punch-in at ${z.start.toFixed(1)} s`, "Zoom")) }]
      : []),
    {
      name: "Effects",
      items: edit.effects.map((e, i) => {
        const [a, b] = effectSpan(e);
        const left = x(Math.max(0, a));
        // Up to the next effect, so neighbours don't cover each other (the full name is in the tooltip).
        const room = (edit.effects[i + 1] ? x(Math.max(0, effectSpan(edit.effects[i + 1])[0])) : Infinity) - left - 2;
        return piece({ kind: "effect", index: i }, left, Math.min(Math.max(x(b) - left, 34), Math.max(10, room)), "bg-purple-300 text-purple-1000 hover:bg-purple-400", `${EFFECTS[e.effect].label} at ${e.at.toFixed(1)} s`, EFFECTS[e.effect].label);
      }),
    },
    ...(showEmojis ? [{ name: "Emojis", items: shows.map((s) => piece({ kind: "emoji", word: s.word }, x(s.start), x(s.end) - x(s.start), "bg-amber-200 hover:bg-amber-300", `${s.emoji} at ${s.start.toFixed(1)} s`, <span className="text-[13px]">{s.emoji}</span>)) }] : []),
    ...(showSounds
      ? [
          {
            name: "Sounds",
            items: edit.sounds.map((s, i) => piece({ kind: "sound", index: i }, x(s.at), Math.max(12, Math.min(60, (edit.sounds[i + 1] ? x(edit.sounds[i + 1].at) : Infinity) - x(s.at) - 2)), "bg-teal-300 text-teal-1000 hover:bg-teal-400", `${REEL_SOUNDS[s.sound].label} at ${s.at.toFixed(1)} s`, `♪ ${REEL_SOUNDS[s.sound].label}`)),
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-lg border border-gray-alpha-400 bg-background-100">
      <div className="flex items-center justify-between border-b border-gray-alpha-400 px-3 py-1.5">
        <p className="text-xs text-gray-900">Timeline · click to move the playhead, click a piece to edit it</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} disabled={zoom === ZOOMS[0]} aria-label="Zoom the timeline out" className="flex size-7 items-center justify-center rounded text-gray-900 hover:bg-gray-alpha-100 disabled:opacity-40">
            <Minus className="size-3.5" />
          </button>
          <span className="w-7 text-center text-xs tabular-nums text-gray-900">{zoom}×</span>
          <button type="button" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Zoom the timeline in" className="flex size-7 items-center justify-center rounded text-gray-900 hover:bg-gray-alpha-100 disabled:opacity-40">
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>
      <div ref={box} className="relative overflow-x-auto overscroll-x-contain">
        <div className="relative" style={{ width: LABEL + full + 16 }}>
          {/* The ruler. */}
          <div className="flex h-6 border-b border-gray-alpha-400">
            <div className="sticky left-0 z-20 shrink-0 bg-background-100" style={{ width: LABEL }} />
            <div className="relative cursor-pointer touch-none" style={{ width: full }} {...scrub}>
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 h-full border-l border-gray-alpha-400 pl-1 text-[10px] tabular-nums leading-6 text-gray-900" style={{ left: x(t) }}>
                  {Math.floor(t / 60)}:{String(Math.floor(t % 60)).padStart(2, "0")}
                </span>
              ))}
            </div>
          </div>
          {tracks.map((track) => (
            <div key={track.name} className="flex h-7 border-b border-gray-alpha-200 last:border-b-0">
              <div className="sticky left-0 z-20 flex shrink-0 items-center bg-background-100 px-2 text-[11px] text-gray-900" style={{ width: LABEL }}>
                {track.name}
              </div>
              <div className="relative cursor-pointer touch-none" style={{ width: full }} {...scrub}>
                {track.items}
              </div>
            </div>
          ))}
          {/* What's cut, hatched across every track; shot changes and the playhead. */}
          {edit.trims.map((t) => (
            <span
              key={`trim-${t.start}`}
              className="pointer-events-none absolute bottom-0 top-6 z-[5] bg-[repeating-linear-gradient(135deg,rgb(229_72_77/0.16)_0_4px,transparent_4px_8px)]"
              style={{ left: LABEL + x(t.start), width: Math.max(2, x(t.end) - x(t.start)) }}
              aria-hidden
            />
          ))}
          {edit.cuts.map((c) => (
            <span key={c} className="pointer-events-none absolute bottom-0 top-6 z-10 border-l border-dashed border-amber-700" style={{ left: LABEL + x(c) }} title={`Cut at ${c.toFixed(1)} s`} />
          ))}
          <span className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-gray-1000" style={{ left: LABEL + x(time) - 1 }} aria-hidden />
        </div>
      </div>
    </div>
  );
}
