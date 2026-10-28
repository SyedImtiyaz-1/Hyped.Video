"use client";
import { Crosshair, Music, Play, Plus, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { REEL_MUSIC, REEL_MUSIC_IDS, type ReelAudio, type ReelMusic } from "@launchreel/core/music-beds";
import { REEL_SOUNDS, type ReelSound } from "@launchreel/core/sounds";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import { previewMusic } from "./sfx-player";
import { SoundLabel, SoundPicker } from "./sound-picker";

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

export type SoundActions = {
  add: (at: number, sound: ReelSound) => void;
  change: (index: number, patch: Partial<{ at: number; sound: ReelSound }>) => void;
  remove: (index: number) => void;
  setHookSound: (sound: ReelSound | null) => void;
  setOn: (on: boolean) => void;
  seek: (t: number) => void;
  /** Background noise taken out of the voice, or not. */
  setClean: (clean: boolean) => void;
  /** A music bed (or none), and its volume (0-1). */
  setMusic: (track: ReelMusic | null) => void;
  setMusicVolume: (volume: number) => void;
};

/**
 * The reel's sound: the voice cleaned of background noise or not, a music bed under it (ducked while it speaks), and the
 * sound effects: on or off, the hook's, and every one in the reel at its second, each changeable, movable and removable.
 */
export function AudioPanel({ sounds, hookSound, hookOn, on, time, audio, actions }: { sounds: { at: number; sound: ReelSound }[]; hookSound: ReelSound | null; hookOn: boolean; on: boolean; time: number; audio: ReelAudio; actions: SoundActions }) {
  // Which picker is open: a row's, the hook's, or the new sound's; and the button it hangs from.
  const [open, setOpen] = useState<number | "hook" | "new" | null>(null);
  const anchor = useRef<HTMLElement | null>(null);
  const openFrom = (which: number | "hook" | "new", el: HTMLElement) => {
    anchor.current = el;
    setOpen(which);
  };
  const value = open === "hook" ? hookSound : typeof open === "number" ? (sounds[open]?.sound ?? null) : null;
  // The track being previewed from the list (it plays its first seconds), stopped when the panel closes.
  const [hearing, setHearing] = useState<ReelMusic | null>(null);
  useEffect(() => () => void previewMusic(null), []);
  const hear = (track: ReelMusic) => {
    const next = hearing === track ? null : track;
    setHearing(next);
    void previewMusic(next);
  };
  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-alpha-400 p-3 text-sm">
        <input type="checkbox" checked={audio.clean} onChange={(e) => actions.setClean(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
        <span>
          <span className="block font-medium text-gray-1000">Clean up background noise</span>
          <span className="mt-0.5 block text-xs text-gray-900">Takes hum, hiss and room noise out of your voice. Heard in the export.</span>
        </span>
      </label>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-1000">
          <Music className="size-3.5" />
          Music
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Music">
          {[null, ...REEL_MUSIC_IDS].map((track) => {
            const picked = (audio.music?.track ?? null) === track;
            return (
              <div key={track ?? "none"} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors", picked ? "border-gray-1000 bg-gray-alpha-100" : "border-gray-alpha-400 hover:bg-gray-alpha-100")}>
                <button type="button" role="radio" aria-checked={picked} onClick={() => actions.setMusic(track)} className="min-w-0 flex-1 text-left">
                  <span className="block text-[13px] font-medium text-gray-1000">{track ? REEL_MUSIC[track].label : "No music"}</span>
                  <span className="block truncate text-xs text-gray-900">{track ? `${REEL_MUSIC[track].mood} · ${REEL_MUSIC[track].bpm} BPM` : "Just your voice and the sound effects"}</span>
                </button>
                {track && (
                  <button type="button" onClick={() => hear(track)} aria-label={hearing === track ? `Stop the ${REEL_MUSIC[track].label} preview` : `Hear ${REEL_MUSIC[track].label}`} className="flex size-8 shrink-0 items-center justify-center rounded-full border border-gray-alpha-400 text-gray-1000 hover:bg-gray-alpha-200">
                    {hearing === track ? <Square className="size-3 fill-current" /> : <Play className="ml-0.5 size-3.5 fill-current" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {audio.music && (
          <label className="mt-3 flex items-center gap-3 text-[13px] text-gray-1000">
            <span className="w-14 shrink-0">Volume</span>
            <input type="range" min={0} max={1} step={0.05} value={audio.music.volume} onChange={(e) => actions.setMusicVolume(Number(e.target.value))} className="h-1 min-w-0 flex-1 accent-[var(--ds-gray-1000)]" aria-label="Music volume" />
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-900">{Math.round(audio.music.volume * 100)}%</span>
          </label>
        )}
        <p className="mt-2 text-xs text-gray-900">Laid under your voice and dipped while you speak, as in the preview. Music by Sascha Ende (ende.app).</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-alpha-400 p-3 text-sm">
        <input type="checkbox" checked={on} onChange={(e) => actions.setOn(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
        <span>
          <span className="block font-medium text-gray-1000">Sound effects</span>
          <span className="mt-0.5 block text-xs text-gray-900">Mixed about 10 dB under your voice. They play in the preview too.</span>
        </span>
      </label>
      {on && (
        <>
          {hookOn && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-alpha-400 p-3">
              <span className="text-sm text-gray-1000">Hook title</span>
              <button type="button" onClick={(e) => openFrom("hook", e.currentTarget)} className="h-8 rounded-md border border-gray-alpha-400 px-2.5 text-[13px] text-gray-1000 hover:bg-gray-alpha-100">
                <SoundLabel sound={hookSound} />
              </button>
            </div>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-gray-1000">In this reel</p>
              <button type="button" onClick={(e) => openFrom("new", e.currentTarget)} className="flex h-8 items-center gap-1.5 rounded-md bg-gray-1000 px-3 text-[13px] font-medium text-background-100">
                <Plus className="size-3.5" />
                Add at {clock(time)}
              </button>
            </div>
            {sounds.length === 0 && <p className="text-[13px] text-gray-900">None yet. Add one at the playhead, or click a word on the video.</p>}
            <ul className="space-y-1.5">
              {sounds.map((s, i) => (
                <li key={`${s.at}-${s.sound}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-alpha-400 px-2.5 py-1.5">
                  <button type="button" onClick={() => actions.seek(Math.max(0, s.at - 0.6))} className="w-14 shrink-0 text-left text-xs tabular-nums text-gray-900 hover:text-gray-1000" title="Play from just before it">
                    {clock(s.at)}
                  </button>
                  <button type="button" onClick={(e) => openFrom(i, e.currentTarget)} className="h-8 min-w-0 flex-1 rounded-md border border-gray-alpha-400 px-2.5 text-left text-[13px] text-gray-1000 hover:bg-gray-alpha-100">
                    <SoundLabel sound={s.sound} />
                  </button>
                  <button type="button" onClick={() => actions.change(i, { at: Math.round(time * 1000) / 1000 })} className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000" title="Move it to the playhead">
                    <Crosshair className="size-3.5" />
                    Move here
                  </button>
                  <button type="button" onClick={() => actions.remove(i)} aria-label={`Remove the ${REEL_SOUNDS[s.sound].label.toLowerCase()} at ${clock(s.at)}`} className="flex size-8 items-center justify-center rounded-md text-gray-900 hover:bg-gray-alpha-100 hover:text-red-900">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <Popover anchor={anchor} open={open !== null} onClose={() => setOpen(null)} label="Pick a sound" width={300}>
        <SoundPicker
          value={value}
          allowNone={open !== "new"}
          onPick={(sound) => {
            if (open === "hook") actions.setHookSound(sound);
            else if (open === "new") sound && actions.add(Math.round(time * 1000) / 1000, sound);
            else if (typeof open === "number") sound ? actions.change(open, { sound }) : actions.remove(open);
            setOpen(null);
          }}
        />
      </Popover>
    </div>
  );
}
