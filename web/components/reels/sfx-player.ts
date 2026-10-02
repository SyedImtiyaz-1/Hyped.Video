"use client";
// The editor's sound effects: the same sounds the render mixes (packages/core/src/sounds.ts), from their AAC copies in
// public/reels/sfx, at the same gains, so the preview sounds like the export. Web Audio, started on the first click.
import { REEL_SOUNDS, soundPreviewUrl, type ReelSound } from "@launchreel/core/sounds";
import type { SoundCue } from "@launchreel/core/timeline";

let context: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume().catch(() => {});
  return context;
}

function load(url: string): Promise<AudioBuffer | null> {
  let buffer = buffers.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
      .then((data) => audio()?.decodeAudioData(data) ?? null)
      .catch(() => null);
    buffers.set(url, buffer);
  }
  return buffer;
}

/** Starts a sound's file `skip` seconds in, at its gain. */
async function start(sound: ReelSound, variant: number, skip = 0, rate = 1): Promise<AudioBufferSourceNode | null> {
  const ctx = audio();
  const buffer = await load(soundPreviewUrl(sound, variant));
  if (!ctx || !buffer || skip >= buffer.duration) return null;
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  gain.gain.value = 10 ** (REEL_SOUNDS[sound].gainDb / 20);
  source.connect(gain).connect(ctx.destination);
  source.start(0, skip);
  return source;
}

/** Plays a sound once, now (the pickers' previews): a little louder than in the mix, so it's heard on its own. */
export function previewSound(sound: ReelSound) {
  void start(sound, 0).then((source) => source?.addEventListener("ended", () => source.disconnect()));
}

/** Loads a reel's sounds ahead of playing them. */
export function preloadSounds(cues: readonly SoundCue[]) {
  for (const cue of cues) void load(soundPreviewUrl(cue.sound, cue.variant));
}

/**
 * Plays a reel's sound cues in step with its video: give it the time every frame. A sound starts when the time passes its
 * start; seeking, pausing or a jump stops what's playing.
 */
export class CuePlayer {
  private last: number | null = null;
  private live = new Set<AudioBufferSourceNode>();
  cues: readonly SoundCue[] = [];

  tick(time: number, playing: boolean) {
    const last = this.last;
    this.last = time;
    if (!playing) return this.stop();
    // Just started (cues right where it starts count), or a seek or a loop: start fresh from here.
    if (last === null || time < last || time - last > 0.5) {
      this.stop();
      if (last !== null && time >= last) return;
      for (const cue of this.cues) if (cue.start <= time && cue.start > time - 0.05) this.fire(cue, time - cue.start);
      return;
    }
    for (const cue of this.cues) if (cue.start > last && cue.start <= time) this.fire(cue, time - cue.start);
  }

  /** Resets after a pause or seek, so the next frame starts fresh. */
  reset() {
    this.last = null;
    this.stop();
  }

  stop() {
    for (const source of this.live) {
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    this.live.clear();
  }

  private fire(cue: SoundCue, late: number) {
    void start(cue.sound, cue.variant, cue.skip + late).then((source) => {
      if (!source) return;
      this.live.add(source);
      source.addEventListener("ended", () => {
        this.live.delete(source);
        source.disconnect();
      });
    });
  }
}
