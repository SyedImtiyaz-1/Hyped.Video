import localFont from "next/font/local";

// The display serif, Instrument Serif (OFL; licence alongside in ./fonts): upright for the dashboard's greeting, italic
// (the caption font of the same name) for the homepage's rotating words.
export const serif = localFont({ src: "../reels/fonts/InstrumentSerif-Italic.ttf", style: "italic", display: "swap" });
export const serifUpright = localFont({ src: "./fonts/InstrumentSerif-Regular.ttf", display: "swap" });
