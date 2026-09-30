// Records the short samples customers hear when choosing a voice: web/public/voices/<id>.mp3.
//   npm run voice-previews        (uses OPENAI_API_KEY from .env; about $0.01 for all six)
// Re-run it after changing a voice or its direction in voice-provider.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { VOICES } from "@launchreel/core/voices";
import { PROVIDER_VOICES, TTS_MODEL } from "./voice-provider.ts";

const OUT = resolve(import.meta.dirname, "../../web/public/voices");
const sample = (name: string) => `Hi, I'm ${name}. Paste your website, and I'll narrate your launch video, just like this.`;

mkdirSync(OUT, { recursive: true });
for (const v of VOICES) {
  const provider = PROVIDER_VOICES[v.id];
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: TTS_MODEL, voice: provider.voice, input: sample(v.name), instructions: provider.direction, response_format: "wav" }),
  });
  if (!res.ok) throw new Error(`${v.id}: speech request failed (${res.status}): ${(await res.text()).replace(/\bsk-[A-Za-z0-9_*.-]{4,}/g, "[key]").slice(0, 200)}`);
  const raw = join(OUT, `${v.id}.raw.wav`);
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  // Same loudness for every sample, so switching voices doesn't jump in volume; small mono MP3s for the web.
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-ac", "1", "-b:a", "96k", join(OUT, `${v.id}.mp3`)]);
  rmSync(raw);
  console.log(`✓ ${v.name} (${v.style}, ${v.accent} ${v.gender.toLowerCase()})`);
}
