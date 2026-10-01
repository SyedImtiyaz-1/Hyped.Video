import type { ReelFont, ReelJob, ReelLanguage, ReelStyle } from "@launchreel/core/reel";

/** The caption looks as customers see them (previews in style-preview.tsx). */
export const REEL_STYLE_INFO: Record<ReelStyle, { label: string; hint: string }> = {
  bold: { label: "Bold", hint: "Big uppercase words, the spoken one pops" },
  behind: { label: "Behind you", hint: "Big words behind you, captions in front" },
  clean: { label: "Clean", hint: "Sentence case, soft shadow" },
  karaoke: { label: "Karaoke", hint: "Words fill in as they're said" },
  minimal: { label: "Minimal", hint: "Small lowercase, lower third" },
};

export const REEL_LANGUAGE_LABEL: Record<ReelLanguage, string> = { auto: "Auto", en: "English", hinglish: "Hinglish" };

/** "Behind you"'s font styles for the big words (previews in font-picker.tsx, the real thing in runner/src/reel.ts). */
export const REEL_FONT_INFO: Record<ReelFont, { label: string; hint: string }> = {
  classic: { label: "Classic", hint: "Bold white capitals" },
  impact: { label: "Impact", hint: "Tall yellow capitals" },
  editorial: { label: "Editorial", hint: "Red magazine serif" },
  elegant: { label: "Elegant", hint: "Soft italic serif" },
  script: { label: "Script", hint: "Blue brush lettering" },
  marker: { label: "Marker", hint: "Hand-drawn capitals" },
  outline: { label: "Outline", hint: "Hollow white letters" },
  pop: { label: "Pop", hint: "Wide lime capitals" },
};

/** "Emojis, zooms, sound effects, hook title", or "Captions only". */
export function reelExtras(reel: Pick<ReelJob, "emojis" | "zooms" | "sfx" | "hook" | "style">): string {
  // "Behind you" has no emojis (its big words carry the emphasis), whatever the option says.
  const on = [reel.emojis && reel.style !== "behind" && "emojis", reel.zooms && "zooms", reel.sfx && "sound effects", reel.hook && "hook title"].filter(Boolean) as string[];
  if (!on.length) return "Captions only";
  const text = on.length > 1 ? `${on.slice(0, -1).join(", ")} and ${on[on.length - 1]}` : on[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A reel's file name, short enough for a heading or a row: no extension, and long machine names (downloaders make
 * ones like "SaveClip.App_AQOpAJwH…") shortened in the middle. The full name goes in a tooltip.
 */
export function reelName(fileName: string, max = 36): string {
  const name = fileName.replace(/\.(mp4|mov|webm|m4v)$/i, "") || fileName;
  return name.length > max ? `${name.slice(0, max - 9)}…${name.slice(-8)}` : name;
}
