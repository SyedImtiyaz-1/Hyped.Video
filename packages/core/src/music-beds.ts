// A reel's sound beyond the voice and the sound effects: background noise cleaned out of the voice, and a music bed.
// The beds are the licensed library's tracks (runner/audio/music: Sascha Ende, CC BY 4.0, credit waived, not in
// Content ID), looped to the reel's length under the voice and ducked while it speaks. The editor plays AAC copies of
// them (public/reels/music) at the same level, so the preview sounds like the export.

export type ReelMusic = "upbeat" | "steady" | "drive" | "bright" | "calm";
export const REEL_MUSIC_IDS: readonly ReelMusic[] = ["upbeat", "steady", "drive", "bright", "calm"];
export const REEL_MUSIC: Record<ReelMusic, { label: string; mood: string; file: string; bpm: number; seconds: number }> = {
  upbeat: { label: "Upbeat", mood: "Energetic and playful", file: "happy-beats-business-moves-vol-1-by-ende-dot-app.mp3", bpm: 120, seconds: 163 },
  steady: { label: "Steady", mood: "Easy-going, for explaining", file: "happy-beats-business-moves-vol-9-by-ende-dot-app.mp3", bpm: 115, seconds: 113 },
  drive: { label: "Drive", mood: "Punchy, for tech and launches", file: "happy-beats-business-moves-vol-10-by-ende-dot-app.mp3", bpm: 110, seconds: 60 },
  bright: { label: "Bright", mood: "Light and friendly", file: "happy-beats-business-moves-vol-11-by-ende-dot-app.mp3", bpm: 115, seconds: 87 },
  calm: { label: "Calm", mood: "Soft, for stories and tips", file: "happy-beats-business-moves-vol-12-by-ende-dot-app.mp3", bpm: 110, seconds: 117 },
};
export const isReelMusic = (v: unknown): v is ReelMusic => REEL_MUSIC_IDS.includes(v as ReelMusic);
export const musicPreviewUrl = (music: ReelMusic) => `/reels/music/${music}.m4a`;

/** The bed's level, from the volume slider (0-1): dB under the mastered track, before ducking. 0.5 is about -19 dB. */
export const musicGainDb = (volume: number) => Math.round((-31 + 24 * Math.min(1, Math.max(0, volume))) * 10) / 10;
/** How far the bed dips while the voice speaks (the preview's ducking; the render uses a sidechain compressor). */
export const MUSIC_DUCK_DB = -9;
export const MUSIC_DEFAULT_VOLUME = 0.5;

/** Clean: background noise taken out of the voice. Music: a bed and its volume (0-1), or none. */
export type ReelAudio = { clean: boolean; music: { track: ReelMusic; volume: number } | null };
export const REEL_AUDIO_NONE: ReelAudio = { clean: false, music: null };

/** A reel's audio settings read back defensively: reels from before had no clean-up and no music. */
export function parseAudio(value: unknown): ReelAudio {
  if (!value || typeof value !== "object") return { ...REEL_AUDIO_NONE };
  const v = value as { clean?: unknown; music?: { track?: unknown; volume?: unknown } | null };
  const music = v.music && isReelMusic(v.music.track) ? { track: v.music.track, volume: typeof v.music.volume === "number" && Number.isFinite(v.music.volume) ? Math.min(1, Math.max(0, Math.round(v.music.volume * 100) / 100)) : MUSIC_DEFAULT_VOLUME } : null;
  return { clean: v.clean === true, music };
}
