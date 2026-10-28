import localFont from "next/font/local";
import type { CaptionFont } from "@launchreel/core/captions";

// The display font files the render draws with (runner/fonts), so previews show what the reel gets. Inter is the
// render's default; Geist, the app's own font, stands in for it here. Each loads only where it's shown (no preload): a
// page with the font picker fetches them all, any other only the ones its captions use.
export const anton = localFont({ src: "./fonts/Anton-Regular.ttf", display: "swap", preload: false });
export const abril = localFont({ src: "./fonts/AbrilFatface-Regular.ttf", display: "swap", preload: false });
export const dmSerif = localFont({ src: "./fonts/DMSerifDisplay-Italic.ttf", style: "italic", display: "swap", preload: false });
export const kaushan = localFont({ src: "./fonts/KaushanScript-Regular.ttf", display: "swap", preload: false });
export const marker = localFont({ src: "./fonts/PermanentMarker-Regular.ttf", display: "swap", preload: false });
export const archivo = localFont({ src: "./fonts/ArchivoBlack-Regular.ttf", display: "swap", preload: false });
// Montserrat in the weights a look can take (CSS font-weight picks one, as the render picks the face).
export const montserrat = localFont({
  src: [
    { path: "./fonts/Montserrat-Light.ttf", weight: "300" },
    { path: "./fonts/Montserrat-Medium.ttf", weight: "500" },
    { path: "./fonts/Montserrat-SemiBold.ttf", weight: "600" },
    { path: "./fonts/Montserrat-ExtraBold.ttf", weight: "800" },
    { path: "./fonts/Montserrat-Black.ttf", weight: "900" },
  ],
  display: "swap",
  preload: false,
});
export const poppins = localFont({ src: "./fonts/Poppins-ExtraBold.ttf", display: "swap", preload: false });
export const tiktok = localFont({ src: "./fonts/TikTokSans-Bold.ttf", display: "swap", preload: false });
export const roboto = localFont({ src: "./fonts/Roboto-Black.ttf", display: "swap", preload: false });
export const rubik = localFont({ src: "./fonts/Rubik-Black.ttf", display: "swap", preload: false });
export const bebas = localFont({ src: "./fonts/BebasNeue-Regular.ttf", display: "swap", preload: false });
export const oswald = localFont({ src: "./fonts/Oswald-Bold.ttf", display: "swap", preload: false });
export const bangers = localFont({ src: "./fonts/Bangers-Regular.ttf", display: "swap", preload: false });
export const luckiest = localFont({ src: "./fonts/LuckiestGuy-Regular.ttf", display: "swap", preload: false });
export const instrument = localFont({ src: "./fonts/InstrumentSerif-Italic.ttf", style: "italic", display: "swap", preload: false });
export const caveat = localFont({ src: "./fonts/Caveat-Bold.ttf", display: "swap", preload: false });

/** The class that sets each caption font (empty for Inter: the page's own font stands in). */
export const CAPTION_FONT_CLASS: Record<CaptionFont, string> = {
  inter: "",
  montserrat: montserrat.className,
  poppins: poppins.className,
  tiktok: tiktok.className,
  roboto: roboto.className,
  rubik: rubik.className,
  anton: anton.className,
  bebas: bebas.className,
  oswald: oswald.className,
  archivo: archivo.className,
  bangers: bangers.className,
  luckiest: luckiest.className,
  abril: abril.className,
  dmserif: dmSerif.className,
  instrument: instrument.className,
  kaushan: kaushan.className,
  caveat: caveat.className,
  marker: marker.className,
};

export const CAPTION_FONT_LABEL: Record<CaptionFont, string> = {
  inter: "Inter",
  montserrat: "Montserrat",
  poppins: "Poppins",
  tiktok: "TikTok Sans",
  roboto: "Roboto",
  rubik: "Rubik",
  anton: "Anton",
  bebas: "Bebas Neue",
  oswald: "Oswald",
  archivo: "Archivo",
  bangers: "Bangers",
  luckiest: "Luckiest Guy",
  abril: "Abril",
  dmserif: "DM Serif",
  instrument: "Instrument Serif",
  kaushan: "Kaushan",
  caveat: "Caveat",
  marker: "Marker",
};
