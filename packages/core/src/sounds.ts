// Sound effects for reels. The render mixes them under the speaker's voice (runner/src/reel.ts); the editor plays the
// same sounds in step with its preview, from AAC copies in web/public/reels/sfx (scripts/sfx.mts writes both).
// Kenney's CC0 packs (runner/audio/sfx), plus transition sounds made with ffmpeg (runner/audio/sfx/synth, ours, CC0).

export type ReelSound =
  | "pop"
  | "hit"
  | "boom"
  | "punch"
  | "bong"
  | "bell"
  | "ding"
  | "click"
  | "switch"
  | "typing"
  | "whoosh"
  | "swoosh"
  | "riser"
  | "glitch"
  | "shutter"
  | "knock"
  | "glass";

/**
 * A sound: its name, its files under runner/audio/sfx (repeats take turns, so the same one never plays twice in a row),
 * the gain that sits it about 10 dB under speech brought to -16 LUFS, and where it lands: a sound placed at a moment
 * starts `peak` seconds early, so a whoosh peaks on the cut and a riser arrives on it.
 */
export type SoundInfo = { label: string; files: readonly string[]; gainDb: number; peak: number };

export const REEL_SOUNDS: Record<ReelSound, SoundInfo> = {
  pop: { label: "Pop", files: ["interface/drop_002.ogg", "interface/drop_003.ogg"], gainDb: -8, peak: 0 },
  hit: { label: "Soft hit", files: ["impact/impactSoft_medium_001.ogg", "impact/impactSoft_medium_004.ogg", "impact/impactSoft_medium_002.ogg"], gainDb: -12, peak: 0 },
  boom: { label: "Boom", files: ["impact/impactSoft_heavy_003.ogg", "impact/impactSoft_heavy_004.ogg"], gainDb: -10, peak: 0 },
  punch: { label: "Punch", files: ["impact/impactPunch_medium_000.ogg", "impact/impactPunch_medium_002.ogg"], gainDb: -11, peak: 0 },
  bong: { label: "Bong", files: ["interface/bong_001.ogg"], gainDb: -13, peak: 0 },
  bell: { label: "Bell", files: ["impact/impactBell_heavy_000.ogg"], gainDb: -9, peak: 0 },
  ding: { label: "Ding", files: ["synth/ding.ogg"], gainDb: -14, peak: 0 },
  click: { label: "Click", files: ["interface/click_002.ogg", "interface/click_003.ogg"], gainDb: -10, peak: 0 },
  switch: { label: "Switch", files: ["interface/switch_002.ogg"], gainDb: -8, peak: 0 },
  typing: { label: "Typing", files: ["synth/typing.ogg"], gainDb: -4, peak: 0 },
  whoosh: { label: "Whoosh", files: ["synth/whoosh.ogg"], gainDb: -12, peak: 0.26 },
  swoosh: { label: "Swoosh", files: ["synth/swoosh.ogg"], gainDb: -12, peak: 0.14 },
  riser: { label: "Riser", files: ["synth/riser.ogg"], gainDb: -10, peak: 1.2 },
  glitch: { label: "Glitch", files: ["synth/glitch.ogg"], gainDb: -12, peak: 0 },
  shutter: { label: "Camera", files: ["synth/shutter.ogg"], gainDb: -9, peak: 0 },
  knock: { label: "Knock", files: ["impact/impactWood_medium_000.ogg"], gainDb: -6, peak: 0 },
  glass: { label: "Glass", files: ["impact/impactGlass_light_001.ogg"], gainDb: -8, peak: 0 },
};

export const REEL_SOUND_IDS = Object.keys(REEL_SOUNDS) as ReelSound[];

/** The sounds as the editor lists them. */
export const SOUND_GROUPS: readonly { label: string; sounds: readonly ReelSound[] }[] = [
  { label: "Transitions", sounds: ["whoosh", "swoosh", "riser", "shutter", "glitch"] },
  { label: "Hits", sounds: ["hit", "boom", "punch", "knock", "pop"] },
  { label: "Accents", sounds: ["ding", "bell", "bong", "glass", "click", "switch", "typing"] },
];

export const isReelSound = (value: unknown): value is ReelSound => typeof value === "string" && value in REEL_SOUNDS;

/** The editor's copy of a sound's `n`th file (web/public/reels/sfx). */
export const soundPreviewUrl = (sound: ReelSound, n: number) => `/reels/sfx/${sound}-${n % REEL_SOUNDS[sound].files.length}.m4a`;
