"use client";
import { Crosshair, Scissors, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { EFFECTS, effectsAt, REEL_EFFECTS, type PlacedEffect, type ReelEffect } from "@launchreel/core/effects";
import { REEL_SOUNDS } from "@launchreel/core/sounds";
import { zoomAim } from "@launchreel/core/timeline";
import { cn } from "@/lib/cn";
import { PictureLayers, useVideoFilter, viewTransform } from "./picture-layers";
import { PICTURE_DEFAULTS } from "@launchreel/core/picture";

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/** An effect playing on the sample frame, on a loop while it's hovered (its peak when still). */
export function EffectThumb({ effect, playing, className }: { effect: ReelEffect; playing: boolean; className?: string }) {
  const spec = EFFECTS[effect];
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!playing) {
      setT(0);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const loop = () => {
      // From a little before the moment to a little after its end, then again.
      const span = spec.length * 2.2 + 0.5;
      setT((((performance.now() - began) / 1000) % span) - spec.length * 0.9 - 0.15);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, spec.length]);
  // Still, each shows a telling frame: half way into a flash or a fade, the peak of a move.
  const still = { flash: -0.1, blackout: -0.2, strobe: 0.03, pullout: 0.05 }[effect as string] ?? 0;
  const fx = effectsAt([{ at: 0, effect, length: spec.length }], playing ? t : still * spec.length);
  const { filter, svg } = useVideoFilter(PICTURE_DEFAULTS, fx, 96);
  return (
    <span className={cn("relative block aspect-[9/16] w-full overflow-hidden rounded-md bg-[#1a1d24]", className)}>
      {svg}
      {/* eslint-disable-next-line @next/next/no-img-element -- the shared sample still */}
      <img src="/reels/sample-frame.jpg" alt="" className="absolute inset-0 size-full object-cover" style={{ ...viewTransform(1 + fx.zoom, fx.dx, fx.dy, zoomAim(9, 16)), filter }} loading="lazy" decoding="async" />
      <PictureLayers picture={PICTURE_DEFAULTS} fx={fx} animate={playing} />
    </span>
  );
}

export type EffectActions = {
  add: (effect: ReelEffect, at: number, withSound: boolean) => void;
  addAtCuts: (effect: ReelEffect, withSound: boolean) => void;
  change: (index: number, patch: Partial<PlacedEffect>) => void;
  remove: (index: number) => void;
  seek: (t: number) => void;
};

/**
 * Transitions and effects, CapCut-style: pick one to put it at the playhead (or on a cut close by), or on every cut;
 * each placed one can change kind, length and moment. "With sound" brings the effect's sound along.
 */
export function EffectsPanel({ effects, cuts, time, actions }: { effects: PlacedEffect[]; cuts: number[]; time: number; actions: EffectActions }) {
  const [hover, setHover] = useState<ReelEffect | null>(null);
  const [withSound, setWithSound] = useState(true);
  const [forCuts, setForCuts] = useState<ReelEffect>("flash");
  const near = cuts.find((c) => Math.abs(c - time) <= 0.3);
  const at = near ?? time;
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] text-gray-900">
            Tap one to add it at <span className="tabular-nums text-gray-1000">{clock(at)}</span>
            {near !== undefined ? " (the cut)" : " (the playhead)"}.
          </p>
          <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-gray-1000">
            <input type="checkbox" checked={withSound} onChange={(e) => setWithSound(e.target.checked)} className="size-3.5 accent-[var(--ds-gray-1000)]" />
            With sound
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {REEL_EFFECTS.map((effect) => (
            <button
              key={effect}
              type="button"
              onClick={() => actions.add(effect, at, withSound)}
              onMouseEnter={() => setHover(effect)}
              onMouseLeave={() => setHover((h) => (h === effect ? null : h))}
              onFocus={() => setHover(effect)}
              onBlur={() => setHover((h) => (h === effect ? null : h))}
              title={EFFECTS[effect].hint}
              className="group rounded-lg border border-gray-alpha-400 p-1.5 text-left transition-colors hover:border-gray-alpha-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-1000"
            >
              <EffectThumb effect={effect} playing={hover === effect} />
              <span className="mt-1 block truncate text-[13px] font-medium text-gray-1000">{EFFECTS[effect].label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-alpha-400 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-1000">
          <Scissors className="size-3.5" />
          At every cut
        </p>
        {cuts.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-[13px] text-gray-900">
              Your video cuts {cuts.length} {cuts.length === 1 ? "time" : "times"}. Add
            </p>
            <select value={forCuts} onChange={(e) => setForCuts(e.target.value as ReelEffect)} aria-label="Transition for every cut" className="h-8 rounded-md border border-gray-alpha-400 bg-background-100 px-2 text-[13px] text-gray-1000">
              {REEL_EFFECTS.map((e) => (
                <option key={e} value={e}>
                  {EFFECTS[e].label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => actions.addAtCuts(forCuts, withSound)} className="h-8 rounded-md bg-gray-1000 px-3 text-[13px] font-medium text-background-100">
              Add to all cuts
            </button>
          </div>
        ) : (
          <p className="mt-1 text-[13px] text-gray-900">No cuts found: this video is one continuous shot. Add effects at moments instead.</p>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-gray-1000">In this reel</p>
        {effects.length === 0 && <p className="text-[13px] text-gray-900">None yet. Add one above, or click a word on the video and pick an effect.</p>}
        <ul className="space-y-2">
          {effects.map((e, i) => {
            const spec = EFFECTS[e.effect];
            return (
              <li key={`${e.at}-${e.effect}-${i}`} className="rounded-lg border border-gray-alpha-400 p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => actions.seek(Math.max(0, e.at - 0.6))} className="w-14 shrink-0 text-left text-xs tabular-nums text-gray-900 hover:text-gray-1000" title="Play from just before it">
                    {clock(e.at)}
                  </button>
                  <select value={e.effect} onChange={(ev) => actions.change(i, { effect: ev.target.value as ReelEffect, length: EFFECTS[ev.target.value as ReelEffect].length })} aria-label="Effect" className="h-8 rounded-md border border-gray-alpha-400 bg-background-100 px-2 text-[13px] text-gray-1000">
                    {REEL_EFFECTS.map((x) => (
                      <option key={x} value={x}>
                        {EFFECTS[x].label}
                      </option>
                    ))}
                  </select>
                  <label className="flex min-w-[140px] flex-1 items-center gap-2 text-xs text-gray-900">
                    Length
                    <input type="range" min={spec.min} max={spec.max} step={0.05} value={e.length} onChange={(ev) => actions.change(i, { length: Number(ev.target.value) })} className="h-1 min-w-0 flex-1 accent-[var(--ds-gray-1000)]" aria-label="Length in seconds" />
                    <span className="w-9 text-right tabular-nums text-gray-1000">{e.length.toFixed(2)}s</span>
                  </label>
                  <button type="button" onClick={() => actions.change(i, { at: Math.round(time * 1000) / 1000 })} className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000" title="Move it to the playhead">
                    <Crosshair className="size-3.5" />
                    Move here
                  </button>
                  <button type="button" onClick={() => actions.remove(i)} aria-label={`Remove the ${spec.label.toLowerCase()} at ${clock(e.at)}`} className="flex size-8 items-center justify-center rounded-md text-gray-900 hover:bg-gray-alpha-100 hover:text-red-900">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                {spec.sound && <p className="mt-1 pl-16 text-xs text-gray-900">Goes well with {REEL_SOUNDS[spec.sound].label.toLowerCase()} (Audio tab).</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
