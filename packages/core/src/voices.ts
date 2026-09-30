// The voices customers can pick for a voiceover. Only names and styles live here, so the web app can show them
// without revealing the provider; the runner maps each id to a provider voice (runner/src/voice.ts).
export type VoiceId = "maya" | "cole" | "jess" | "leo" | "alice" | "george";

export type VoiceOption = {
  id: VoiceId;
  name: string;
  gender: "Female" | "Male"; // how the voice sounds
  accent: "American" | "British";
  style: "Warm" | "Energetic" | "Calm";
};

export const VOICES: readonly VoiceOption[] = [
  { id: "maya", name: "Maya", gender: "Female", accent: "American", style: "Warm" },
  { id: "cole", name: "Cole", gender: "Male", accent: "American", style: "Warm" },
  { id: "jess", name: "Jess", gender: "Female", accent: "American", style: "Energetic" },
  { id: "leo", name: "Leo", gender: "Male", accent: "American", style: "Energetic" },
  { id: "alice", name: "Alice", gender: "Female", accent: "British", style: "Calm" },
  { id: "george", name: "George", gender: "Male", accent: "British", style: "Calm" },
];

export const VOICE_IDS = VOICES.map((v) => v.id) as [VoiceId, ...VoiceId[]];

export const voiceById = (id: string | null | undefined): VoiceOption | undefined => VOICES.find((v) => v.id === id);
