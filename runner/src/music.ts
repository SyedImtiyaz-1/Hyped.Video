// Picks each video's soundtrack from the licensed library (runner/audio/music/library.json) instead of leaving it to the
// agent, which kept reaching for the same few tracks: by mood (from the tone, the template, then the video type), long
// enough for the video, and rotated per customer so back-to-back videos sound different.
import type { BragRequest } from "@launchreel/core/contract";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type Mood = "energetic" | "tech" | "corporate" | "cinematic" | "chill" | "hiphop" | "playful" | "calm";

export type Track = {
  /** File name under audio/music/; its cues are cues/<name>.music-cues.md and .json. */
  file: string;
  title: string;
  /** Best fit first. */
  moods: Mood[];
  bpm: number;
  seconds: number;
  /** Where it came from and under what license (see audio/README.md). */
  source: string;
  license: string;
};

// The tone is the customer's own choice (the Style step), so it wins. Values from web/app/dashboard/new.
const TONE_MOODS: Record<string, Mood[]> = {
  polished: ["calm", "corporate"],
  default: ["playful", "energetic"],
  "yc-parody": ["corporate", "playful"],
  cinematic: ["cinematic", "tech"],
  "app-store": ["energetic", "tech"],
  deadpan: ["calm", "chill"],
  chaotic: ["hiphop", "energetic"],
};

// Templates (packages/core/src/templates.ts).
const TEMPLATE_MOODS: Record<string, Mood[]> = {
  "launch-day": ["energetic", "cinematic"],
  "three-features": ["energetic", "tech"],
  teaser: ["tech", "cinematic"],
  "feature-drop": ["tech", "energetic"],
  walkthrough: ["corporate", "chill"],
  "problem-solution": ["tech", "corporate"],
  "before-after": ["energetic", "playful"],
  "founder-demo": ["corporate", "calm"],
  "social-proof": ["corporate", "energetic"],
  "readme-loop": ["chill", "tech"],
};

const TYPE_MOODS: Record<string, Mood[]> = {
  launch: ["energetic", "tech"],
  demo: ["corporate", "chill"],
  feature: ["tech", "energetic"],
};

/** The moods a video should sound like, best first. */
export function moodsFor(req: Pick<BragRequest, "tone" | "template" | "videoType">): Mood[] {
  return (req.tone && TONE_MOODS[req.tone]) || (req.template && TEMPLATE_MOODS[req.template]) || TYPE_MOODS[req.videoType ?? "launch"] || ["energetic"];
}

export function loadLibrary(audioDir: string): Track[] {
  const file = join(audioDir, "music", "library.json");
  if (!existsSync(file)) return [];
  const tracks = JSON.parse(readFileSync(file, "utf8")) as Track[];
  return tracks.filter((t) => existsSync(join(audioDir, "music", t.file)));
}

/**
 * The track for this video, or null when the library has nothing that fits (the agent then chooses, as before).
 * Tracks in the video's two best moods and at least as long as the video, in a fixed order, so the seed that goes up
 * with each of a customer's videos walks through them one by one.
 */
export function pickTrack(req: BragRequest, library: Track[]): Track | null {
  const need = (req.durationSec ?? 20) + 2;
  const long = library.filter((t) => t.seconds >= need).sort((a, b) => a.file.localeCompare(b.file));
  const moods = moodsFor(req);
  const pools = [moods.slice(0, 2), moods, null];
  for (const wanted of pools) {
    const pool = wanted ? long.filter((t) => t.moods.some((m) => wanted.includes(m))) : long;
    if (pool.length) return pool[Math.abs(Math.trunc(req.musicSeed ?? 0)) % pool.length];
  }
  return null;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** The brief's sound line for a picked track. */
export function trackBrief(track: Track): string {
  const cues = track.file.replace(/\.[a-z0-9]+$/i, ".music-cues.md");
  return [
    `Sound: use the music track .hyped/audio/music/${track.file} ("${track.title}": ${track.moods.join(", ")}, about ${Math.round(track.bpm)} BPM, ${clock(track.seconds)} long).`,
    "It was chosen for this video so customers' videos don't all sound alike: use it, not another track.",
    `Its beat grid and strong cues are in .hyped/audio/music/cues/${cues}: cut scenes on beats and land the reveal and the end card on strong cues.`,
    "Add a few sound effects from .hyped/audio/sfx on real on-screen events (see .hyped/audio/README.md), and write the track's file name to brag-output/music.txt.",
  ].join(" ");
}
