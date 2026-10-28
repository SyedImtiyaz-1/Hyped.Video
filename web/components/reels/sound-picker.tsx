"use client";
import { Play, Volume2 } from "lucide-react";
import { REEL_SOUNDS, SOUND_GROUPS, type ReelSound } from "@launchreel/core/sounds";
import { cn } from "@/lib/cn";
import { previewSound } from "./sfx-player";

/** The sound effects by group, each with a play button to hear it; picking one plays it too. */
export function SoundPicker({ value, onPick, allowNone = true, className }: { value: ReelSound | null; onPick: (sound: ReelSound | null) => void; allowNone?: boolean; className?: string }) {
  return (
    <div className={cn("w-full space-y-2.5 rounded-lg border border-gray-alpha-400 bg-background-100 p-2.5 shadow-lg", className)}>
      {allowNone && (
        <button type="button" aria-pressed={value === null} onClick={() => onPick(null)} className={cn("h-8 w-full rounded-md border px-2.5 text-left text-[13px]", value === null ? "border-gray-1000 bg-gray-alpha-200 text-gray-1000" : "border-gray-alpha-400 text-gray-1000 hover:bg-gray-alpha-100")}>
          No sound
        </button>
      )}
      {SOUND_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1 text-xs text-gray-900">{group.label}</p>
          <div className="grid grid-cols-2 gap-1">
            {group.sounds.map((sound) => (
              <div key={sound} className={cn("flex h-8 items-center rounded-md border text-[13px]", value === sound ? "border-gray-1000 bg-gray-alpha-200" : "border-gray-alpha-400 hover:bg-gray-alpha-100")}>
                <button type="button" onClick={() => previewSound(sound)} aria-label={`Play ${REEL_SOUNDS[sound].label}`} className="flex h-full w-7 shrink-0 items-center justify-center text-gray-900 hover:text-gray-1000">
                  <Play className="size-3 fill-current" />
                </button>
                <button
                  type="button"
                  aria-pressed={value === sound}
                  onClick={() => {
                    previewSound(sound);
                    onPick(sound);
                  }}
                  className="h-full min-w-0 flex-1 truncate pr-2 text-left text-gray-1000"
                >
                  {REEL_SOUNDS[sound].label}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A sound's name with a speaker icon, or "No sound". */
export function SoundLabel({ sound }: { sound: ReelSound | null }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Volume2 className="size-3.5" />
      {sound ? REEL_SOUNDS[sound].label : "No sound"}
    </span>
  );
}
