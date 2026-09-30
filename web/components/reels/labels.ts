import type { ReelJob, ReelLanguage, ReelStyle } from "@launchreel/core/reel";

/** The caption looks as customers see them (previews in style-preview.tsx). */
export const REEL_STYLE_INFO: Record<ReelStyle, { label: string; hint: string }> = {
  bold: { label: "Bold", hint: "Big uppercase words, the spoken one pops" },
  clean: { label: "Clean", hint: "Sentence case, soft shadow" },
  karaoke: { label: "Karaoke", hint: "Words fill in as they're said" },
  minimal: { label: "Minimal", hint: "Small lowercase, lower third" },
};

export const REEL_LANGUAGE_LABEL: Record<ReelLanguage, string> = { auto: "Auto", en: "English", hinglish: "Hinglish" };

/** "Emojis, zooms, sound effects, hook title", or "Captions only". */
export function reelExtras(reel: Pick<ReelJob, "emojis" | "zooms" | "sfx" | "hook">): string {
  const on = [reel.emojis && "emojis", reel.zooms && "zooms", reel.sfx && "sound effects", reel.hook && "hook title"].filter(Boolean) as string[];
  if (!on.length) return "Captions only";
  const text = on.length > 1 ? `${on.slice(0, -1).join(", ")} and ${on[on.length - 1]}` : on[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}
