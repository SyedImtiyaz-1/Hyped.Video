"use client";
import { Minus, Plus, Scissors, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { CaptionLine } from "@launchreel/core/captions";
import { EFFECTS, effectSpan } from "@launchreel/core/effects";
import { REEL_MUSIC } from "@launchreel/core/music-beds";
import type { ReelEdit } from "@launchreel/core/reel";
import { REEL_SOUNDS } from "@launchreel/core/sounds";
import { emojiShows, type ZoomWindow } from "@launchreel/core/timeline";
import { cn } from "@/lib/cn";

export type TimelineItem =
  | { kind: "line"; word: number }
  | { kind: "effect"; index: number }
  | { kind: "zoom"; word: number }
  | { kind: "emoji"; word: number }
  | { kind: "sound"; index: number }
  | { kind: "trim"; index: number }
  | { kind: "broll"; index: number }
  | { kind: "music" };
/** A B-roll shot's span on the recording's clock (it plays straight over any cut inside it). */
export type BrollSpan = { index: number; start: number; end: number; query: string };
/** A piece being dragged: by its body (moved) or by an edge (resized), `delta` seconds from where the drag began. */
export type TimelineDrag = { item: TimelineItem; mode: "move" | "start" | "end"; delta: number };

const TRIM_NAME = { pause: "Pause", filler: "Filler", retake: "Retake", cut: "Cut" } as const;

const LABEL = 64;
const ZOOMS = [1, 2, 4, 8];
// A press that moves less than this is a click, not a drag.
const DRAG_PX = 3;

const same = (a: TimelineItem | null | undefined, b: TimelineItem) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The reel along time, CapCut-style, on the recording's clock: the video, what's cut (hatched across every track), the
 * captions, the B-roll, the effects and punch-ins, the emojis, the sounds and the music, the shot changes marked across
 * them, and the playhead. Click or drag the ruler to move the playhead; click a piece to select it and edit it.
 *
 * Editing on it, as Cardboard's and CapCut's timelines do: drag a B-roll shot, an effect, a sound or a cut to move it,
 * and the edge of a shot, an effect or a cut to change its length (`onDrag` while it moves, live; `onDragEnd` after);
 * drag across the video to select a stretch (`onRange`) and cut it out (`onCutRange`).
 */
export function ReelTimeline({
  edit,
  lines,
  windows,
  broll,
  time,
  duration,
  showEmojis,
  showZooms,
  showSounds,
  selected,
  range,
  onSeek,
  onPick,
  onDrag,
  onDragEnd,
  onRange,
  onCutRange,
}: {
  edit: ReelEdit;
  lines: CaptionLine[];
  windows: ZoomWindow[];
  broll: BrollSpan[];
  time: number;
  duration: number;
  showEmojis: boolean;
  showZooms: boolean;
  showSounds: boolean;
  selected?: TimelineItem | null;
  range?: [number, number] | null;
  onSeek: (t: number) => void;
  onPick: (item: TimelineItem) => void;
  onDrag?: (drag: TimelineDrag) => void;
  onDragEnd?: () => void;
  onRange?: (range: [number, number] | null) => void;
  onCutRange?: () => void;
}) {
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
  const capture = (e: ReactPointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };
  const scrub = {
    onPointerDown: (e: ReactPointerEvent) => {
      if ((e.target as HTMLElement).closest("[data-piece]")) return;
      seeking.current = true;
      capture(e);
      onSeek(timeAt(e));
    },
    onPointerMove: (e: ReactPointerEvent) => seeking.current && onSeek(timeAt(e)),
    onPointerUp: () => (seeking.current = false),
  };

  // The video track: a click moves the playhead, a drag selects the stretch to cut.
  const selecting = useRef<{ from: number; x0: number; moved: boolean } | null>(null);
  const video = {
    onPointerDown: (e: ReactPointerEvent) => {
      capture(e);
      selecting.current = { from: timeAt(e), x0: e.clientX, moved: false };
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const s = selecting.current;
      if (!s) return;
      if (!s.moved && Math.abs(e.clientX - s.x0) < DRAG_PX) return;
      s.moved = true;
      const to = timeAt(e);
      onRange?.([Math.min(s.from, to), Math.max(s.from, to)]);
    },
    onPointerUp: (e: ReactPointerEvent) => {
      const s = selecting.current;
      selecting.current = null;
      if (s && !s.moved) {
        onRange?.(null);
        onSeek(timeAt(e));
      }
    },
  };

  // A piece: a click picks it; a drag of its body moves it, of an edge resizes it (where `edges` allows).
  const dragging = useRef<{ item: TimelineItem; mode: TimelineDrag["mode"]; x0: number; moved: boolean } | null>(null);
  const grip = (item: TimelineItem, moves: boolean, edges: { start?: boolean; end?: boolean }) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.stopPropagation();
      const edge = (e.target as HTMLElement).dataset.edge as "start" | "end" | undefined;
      const mode = edge && edges[edge] ? edge : "move";
      if (mode === "move" && !moves) return void (dragging.current = { item, mode, x0: e.clientX, moved: false });
      capture(e);
      dragging.current = { item, mode, x0: e.clientX, moved: false };
    },
    onPointerMove: (e: ReactPointerEvent) => {
      const d = dragging.current;
      if (!d || !onDrag || (d.mode === "move" && !moves)) return;
      if (!d.moved && Math.abs(e.clientX - d.x0) < DRAG_PX) return;
      d.moved = true;
      onDrag({ item: d.item, mode: d.mode, delta: (e.clientX - d.x0) / perSecond });
    },
    onPointerUp: () => {
      const d = dragging.current;
      dragging.current = null;
      if (!d) return;
      if (d.moved) onDragEnd?.();
      else onPick(d.item);
    },
  });

  const step = duration > 60 ? 10 : duration > 20 ? 5 : 2;
  const ticks = Array.from({ length: Math.floor(duration / step) + 1 }, (_, k) => k * step);
  const piece = (
    item: TimelineItem,
    left: number,
    w: number,
    className: string,
    title: string,
    children: React.ReactNode,
    editable: { moves?: boolean; start?: boolean; end?: boolean } = {},
  ) => {
    const on = same(selected, item);
    const canEdit = Boolean(onDrag) && (editable.moves || editable.start || editable.end);
    return (
      <div
        key={JSON.stringify(item)}
        role="button"
        tabIndex={0}
        data-piece
        title={title}
        aria-label={title}
        aria-pressed={on}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(item))}
        {...grip(item, Boolean(editable.moves), editable)}
        className={cn(
          "absolute top-1 flex h-5 touch-none select-none items-center overflow-hidden whitespace-nowrap rounded px-1 text-[11px] leading-none outline-none focus-visible:ring-2 focus-visible:ring-gray-1000",
          editable.moves && onDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
          on && "z-10 ring-2 ring-gray-1000",
          className,
        )}
        style={{ left, width: Math.max(w, 6) }}
      >
        {canEdit && editable.start && <span data-edge="start" className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20" />}
        <span className="pointer-events-none truncate">{children}</span>
        {canEdit && editable.end && <span data-edge="end" className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-black/0 hover:bg-black/20" />}
      </div>
    );
  };
  const shows = showEmojis ? emojiShows(edit, lines) : [];
  const music = edit.audio.music;
  const tracks: { name: string; items: React.ReactNode[] }[] = [
    ...(edit.trims.length
      ? [
          {
            name: "Cuts",
            items: edit.trims.map((t, i) =>
              piece({ kind: "trim", index: i }, x(t.start), x(t.end) - x(t.start), "bg-red-300 text-red-1000 hover:bg-red-400", `${TRIM_NAME[t.reason]} cut, ${(t.end - t.start).toFixed(1)} s at ${t.start.toFixed(1)} s`, TRIM_NAME[t.reason], { moves: true, start: true, end: true }),
            ),
          },
        ]
      : []),
    {
      name: "Captions",
      items: lines.map((l) => piece({ kind: "line", word: l.words[0].i }, x(l.start), x(l.end) - x(l.start) - 1, "bg-gray-alpha-300 text-gray-1000 hover:bg-gray-alpha-400", l.text, l.text)),
    },
    ...(broll.length
      ? [
          {
            name: "B-roll",
            items: broll.map((b) =>
              piece({ kind: "broll", index: b.index }, x(b.start), x(b.end) - x(b.start) - 1, "bg-green-300 text-green-1000 hover:bg-green-400", `B-roll: ${b.query || "stock clip"} at ${b.start.toFixed(1)} s`, b.query || "B-roll", { moves: true, start: true, end: true }),
            ),
          },
        ]
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
        return piece({ kind: "effect", index: i }, left, Math.min(Math.max(x(b) - left, 34), Math.max(10, room)), "bg-purple-300 text-purple-1000 hover:bg-purple-400", `${EFFECTS[e.effect].label} at ${e.at.toFixed(1)} s`, EFFECTS[e.effect].label, { moves: true, end: true });
      }),
    },
    ...(showEmojis ? [{ name: "Emojis", items: shows.map((s) => piece({ kind: "emoji", word: s.word }, x(s.start), x(s.end) - x(s.start), "bg-amber-200 hover:bg-amber-300", `${s.emoji} at ${s.start.toFixed(1)} s`, <span className="text-[13px]">{s.emoji}</span>)) }] : []),
    ...(showSounds
      ? [
          {
            name: "Sounds",
            items: edit.sounds.map((s, i) =>
              piece({ kind: "sound", index: i }, x(s.at), Math.max(12, Math.min(60, (edit.sounds[i + 1] ? x(edit.sounds[i + 1].at) : Infinity) - x(s.at) - 2)), "bg-teal-300 text-teal-1000 hover:bg-teal-400", `${REEL_SOUNDS[s.sound].label} at ${s.at.toFixed(1)} s`, `♪ ${REEL_SOUNDS[s.sound].label}`, { moves: true }),
            ),
          },
        ]
      : []),
    ...(music ? [{ name: "Music", items: [piece({ kind: "music" }, 0, full - 1, "bg-pink-200 text-pink-1000 hover:bg-pink-300", `Music: ${REEL_MUSIC[music.track].label}, ${Math.round(music.volume * 100)}%`, `♫ ${REEL_MUSIC[music.track].label} · ${Math.round(music.volume * 100)}%`)] }] : []),
  ];

  return (
    <div className="rounded-lg border border-gray-alpha-400 bg-background-100">
      <div className="flex items-center justify-between gap-3 border-b border-gray-alpha-400 px-3 py-1.5">
        <p className="min-w-0 truncate text-xs text-gray-900">
          Timeline · drag a piece to move it, its edge to resize · drag across Video to cut a part · Delete removes · Space plays
        </p>
        <div className="flex shrink-0 items-center gap-1">
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
          {/* The video: the recording, from start to end. */}
          <div className="flex h-9 border-b border-gray-alpha-200">
            <div className="sticky left-0 z-20 flex shrink-0 items-center bg-background-100 px-2 text-[11px] text-gray-900" style={{ width: LABEL }}>
              Video
            </div>
            <div className="relative cursor-text touch-none" style={{ width: full }} {...video}>
              <div className="absolute inset-y-1 left-0 right-0 rounded bg-[repeating-linear-gradient(90deg,var(--ds-gray-alpha-300)_0_2px,var(--ds-gray-alpha-200)_2px_6px)]" />
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
          {/* The stretch selected on the video, and what to do with it. */}
          {range && (
            <>
              <span className="pointer-events-none absolute bottom-0 top-6 z-[6] border-x-2 border-blue-700 bg-blue-700/15" style={{ left: LABEL + x(range[0]), width: Math.max(2, x(range[1]) - x(range[0])) }} aria-hidden />
              <div className="absolute top-7 z-30 flex items-center gap-1 rounded-md border border-gray-alpha-400 bg-background-100 p-0.5 shadow-lg" style={{ left: LABEL + x((range[0] + range[1]) / 2), transform: "translateX(-50%)" }}>
                <button type="button" onClick={onCutRange} className="flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium text-gray-1000 hover:bg-gray-alpha-200">
                  <Scissors className="size-3" /> Cut out {(range[1] - range[0]).toFixed(1)} s
                </button>
                <button type="button" onClick={() => onRange?.(null)} aria-label="Clear the selection" className="flex size-6 items-center justify-center rounded text-gray-900 hover:bg-gray-alpha-200">
                  <X className="size-3" />
                </button>
              </div>
            </>
          )}
          <span className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-gray-1000" style={{ left: LABEL + x(time) - 1 }} aria-hidden />
        </div>
      </div>
    </div>
  );
}
