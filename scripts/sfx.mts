// Sound effects for reels (the catalog is packages/core/src/sounds.ts).
//
//   synth  makes the transition sounds the Kenney packs don't have: runner/audio/sfx/synth/*.ogg (ours, CC0). Needs
//          libvorbis, which the render image's ffmpeg has (Homebrew's doesn't):
//            docker run --rm -v "$PWD":/repo -w /repo --entrypoint node <render image> scripts/sfx.mts synth
//   web    writes the editor's AAC copy of every sound's files: web/public/reels/sfx/<sound>-<n>.m4a
//            node scripts/sfx.mts web
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { REEL_SOUND_IDS, REEL_SOUNDS } from "../packages/core/src/sounds.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SFX = join(ROOT, "runner/audio/sfx");
const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

// Layers of band-passed noise whose swells overlap a little later each, so the sound sweeps past.
const sweep = (seconds: number, bands: [hz: number, peak: number, tail: number, gain: number][]) =>
  `anoisesrc=d=${seconds}:c=pink:r=48000:a=0.7:s=11,asplit=${bands.length}${bands.map((_, i) => `[n${i}]`).join("")};` +
  bands.map(([hz, peak, tail, gain], i) => `[n${i}]bandpass=f=${hz}:t=q:w=1.4,afade=t=in:d=${peak}:curve=qsin,afade=t=out:st=${peak}:d=${tail}:curve=qsin,volume=${gain}[b${i}]`).join(";") +
  `;${bands.map((_, i) => `[b${i}]`).join("")}amix=inputs=${bands.length}:normalize=0,lowpass=f=9000`;

const SYNTH: Record<string, { graph: string; inputs?: string[] }> = {
  whoosh: { graph: sweep(0.62, [[420, 0.24, 0.36, 2.2], [1100, 0.26, 0.32, 1.6], [2800, 0.28, 0.26, 1]]) },
  swoosh: { graph: sweep(0.36, [[1600, 0.13, 0.2, 1.6], [3600, 0.14, 0.18, 1.2], [7000, 0.15, 0.15, 0.8]]) },
  riser: {
    graph:
      "aevalsrc=exprs='0.25*sin(2*PI*(110*t+260*t*t))+0.12*sin(2*PI*(220*t+520*t*t))':d=1.3:s=48000,afade=t=in:d=1.2:curve=exp,afade=t=out:st=1.24:d=0.06[tone];" +
      "anoisesrc=d=1.3:c=white:r=48000:a=0.5:s=5,highpass=f=1800,lowpass=f=9000,afade=t=in:d=1.2:curve=exp,afade=t=out:st=1.24:d=0.06,volume=0.5[air];" +
      "[tone][air]amix=inputs=2:normalize=0",
  },
  shutter: {
    graph:
      "anoisesrc=d=0.012:c=white:r=48000:a=0.9:s=3,highpass=f=1500,afade=t=out:d=0.012[c1];" +
      "anoisesrc=d=0.02:c=white:r=48000:a=0.8:s=4,highpass=f=1200,afade=t=out:d=0.02,adelay=70[c2];" +
      "aevalsrc=exprs='0.6*sin(2*PI*170*t)*exp(-60*t)':d=0.06:s=48000[thunk];" +
      "[c1][c2][thunk]amix=inputs=3:normalize=0:duration=longest,apad=pad_dur=0.1",
  },
  ding: { graph: "aevalsrc=exprs='(0.5*sin(2*PI*1568*t)*exp(-3.5*t)+0.2*sin(2*PI*3136*t)*exp(-6*t)+0.1*sin(2*PI*4704*t)*exp(-9*t))*min(1\\,t/0.003)':d=1:s=48000" },
  typing: {
    inputs: ["keyboard/keypress-003.wav", "keyboard/keypress-011.wav", "keyboard/keypress-007.wav", "keyboard/keypress-015.wav", "keyboard/keypress-002.wav"],
    graph: "[0:a]aresample=48000[k0];[1:a]aresample=48000,adelay=105[k1];[2:a]aresample=48000,adelay=190[k2];[3:a]aresample=48000,adelay=320[k3];[4:a]aresample=48000,adelay=430[k4];[k0][k1][k2][k3][k4]amix=inputs=5:normalize=0:duration=longest",
  },
  glitch: {
    inputs: ["interface/glitch_002.ogg", "interface/glitch_004.ogg", "interface/glitch_002.ogg"],
    graph:
      "[0:a]aresample=48000[g0];[1:a]aresample=48000,adelay=60[g1];[2:a]aresample=48000,adelay=210[g2];" +
      "anoisesrc=d=0.05:c=white:r=48000:a=0.5:s=9,acrusher=bits=4:mode=log:aa=1,highpass=f=600,afade=t=out:st=0.03:d=0.02,adelay=120[burst];" +
      "[g0][g1][g2][burst]amix=inputs=4:normalize=0:duration=longest,apad=pad_dur=0.05",
  },
};

/** The loudest sample, in dB. */
const maxVolume = (file: string) => Number(/max_volume: (-?[\d.]+) dB/.exec(spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr)?.[1] ?? 0);

function synth() {
  const out = join(SFX, "synth");
  mkdirSync(out, { recursive: true });
  for (const [name, { graph, inputs = [] }] of Object.entries(SYNTH)) {
    const raw = join(out, `${name}.raw.wav`);
    ffmpeg([...inputs.flatMap((f) => ["-i", join(SFX, f)]), "-filter_complex", `${graph},aformat=channel_layouts=mono[out]`, "-map", "[out]", "-c:a", "pcm_s16le", raw]);
    // Every file peaks at -1 dB, like Kenney's; the catalog's gain sets the level in the mix.
    ffmpeg(["-i", raw, "-af", `volume=${(-1 - maxVolume(raw)).toFixed(2)}dB`, "-c:a", "libvorbis", "-q:a", "6", join(out, `${name}.ogg`)]);
    rmSync(raw);
    console.log(`synth/${name}.ogg`);
  }
}

function web() {
  const out = join(ROOT, "web/public/reels/sfx");
  mkdirSync(out, { recursive: true });
  for (const id of REEL_SOUND_IDS)
    REEL_SOUNDS[id].files.forEach((file, n) => {
      ffmpeg(["-i", join(SFX, file), "-ac", "1", "-ar", "44100", "-c:a", "aac", "-b:a", "96k", join(out, `${id}-${n}.m4a`)]);
      console.log(`${id}-${n}.m4a  ← ${file}`);
    });
}

const mode = process.argv[2];
if (mode === "synth") synth();
else if (mode === "web") web();
else {
  console.error("usage: node scripts/sfx.mts synth|web");
  process.exit(1);
}
