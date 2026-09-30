// What each customer-facing voice is underneath (names and styles live in @launchreel/core/voices).
// Server-side only: the web app never sees which provider or voice is used.
import type { VoiceId } from "@launchreel/core/voices";

// wordsPerSecond: how fast each voice really speaks, for the script's word budget (the model ignores speed settings).
// Measured on the preview samples (Sept 2026) and set about 10% lower, since production lines ran that much slower.
export const PROVIDER_VOICES: Record<VoiceId, { voice: string; direction: string; wordsPerSecond: number }> = {
  maya: { voice: "marin", direction: "Warm, confident and friendly, like a founder introducing something they're proud of. Natural, unhurried pace.", wordsPerSecond: 2.4 },
  cole: { voice: "cedar", direction: "Warm, grounded and confident, like a founder explaining their product to a friend. Natural, unhurried pace.", wordsPerSecond: 2.5 },
  jess: { voice: "coral", direction: "Bright, upbeat launch-day energy. Crisp and punchy, smiling, never shouty. Slightly quick pace.", wordsPerSecond: 2.0 },
  leo: { voice: "ash", direction: "Upbeat and punchy, like a keynote reveal. Crisp and confident. Slightly quick pace.", wordsPerSecond: 1.9 },
  alice: { voice: "sage", direction: "Speak with a natural British accent (Received Pronunciation). Calm, clear and assured, like a premium product film.", wordsPerSecond: 1.7 },
  george: { voice: "fable", direction: "Speak with a natural British accent (Received Pronunciation). Calm, measured and assured, like a documentary narrator.", wordsPerSecond: 2.1 },
};
export const TTS_MODEL = process.env.HYPED_TTS_MODEL ?? "gpt-4o-mini-tts";
