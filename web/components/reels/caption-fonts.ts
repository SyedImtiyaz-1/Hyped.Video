import localFont from "next/font/local";
import type { CaptionFont } from "@launchreel/core/captions";

// The display font files the render draws with (runner/fonts), so previews show what the reel gets. Inter is the
// render's default; Geist, the app's own font, stands in for it here.
export const anton = localFont({ src: "./fonts/Anton-Regular.ttf", display: "swap" });
export const abril = localFont({ src: "./fonts/AbrilFatface-Regular.ttf", display: "swap" });
export const dmSerif = localFont({ src: "./fonts/DMSerifDisplay-Italic.ttf", style: "italic", display: "swap" });
export const kaushan = localFont({ src: "./fonts/KaushanScript-Regular.ttf", display: "swap" });
export const marker = localFont({ src: "./fonts/PermanentMarker-Regular.ttf", display: "swap" });
export const archivo = localFont({ src: "./fonts/ArchivoBlack-Regular.ttf", display: "swap" });

/** The class that sets each caption font (empty for Inter: the page's own font stands in). */
export const CAPTION_FONT_CLASS: Record<CaptionFont, string> = {
  inter: "",
  anton: anton.className,
  abril: abril.className,
  archivo: archivo.className,
  dmserif: dmSerif.className,
  kaushan: kaushan.className,
  marker: marker.className,
};

export const CAPTION_FONT_LABEL: Record<CaptionFont, string> = {
  inter: "Inter",
  anton: "Anton",
  archivo: "Archivo",
  abril: "Abril",
  dmserif: "DM Serif",
  kaushan: "Kaushan",
  marker: "Marker",
};
