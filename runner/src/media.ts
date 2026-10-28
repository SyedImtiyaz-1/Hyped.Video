// Caption and audio helpers shared by the voice tool (voice.ts) and the reel editor (reel.ts): caption phrasing,
// SRT files and loudness mastering.
import { execFileSync, spawnSync } from "node:child_process";

// Words and phrasing live in @launchreel/core/words, shared with the web app's reel editor.
export { bare, endsClause, endsSentence, groupWords, norm, POWER, round, STOP, strongestWord, VOICE_PHRASES, WEAK, type Group, type PhraseLimits, type Word } from "@launchreel/core/words";
import { endsClause, endsSentence, round, type Word } from "@launchreel/core/words";
const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });

export const srtTime = (t: number) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

/** SRT cues for uploads: sentence-sized, at most 2 lines of about 42 characters. */
export function srtCues(words: Word[], lineEnds: Set<number>) {
  const cues: { start: number; end: number; text: string }[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    const text = cur.map((w) => w.text).join(" ");
    let lines = [text];
    if (text.length > 42) {
      // Break near the middle, at a space.
      const mid = text.length / 2;
      let best = -1;
      for (let i = 0; i < text.length; i++) if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
      if (best > 0) lines = [text.slice(0, best), text.slice(best + 1)];
    }
    cues.push({ start: cur[0].start, end: cur[cur.length - 1].end, text: lines.join("\n") });
    cur = [];
  };
  words.forEach((w, i) => {
    const chars = [...cur, w].map((x) => x.text).join(" ").length;
    if (cur.length && chars > 84) {
      // Too long for one cue: end it at the last comma if there is a sensible one, else here.
      let comma = -1;
      for (let k = cur.length - 1; k >= 3 && comma < 0; k--) if (endsClause(cur[k].text)) comma = k;
      if (comma > 0) {
        const rest = cur.slice(comma + 1);
        cur = cur.slice(0, comma + 1);
        flush();
        cur = rest;
      } else flush();
    }
    cur.push(w);
    if (lineEnds.has(i) || endsSentence(w.text) || w.end - cur[0].start > 6) flush();
  });
  flush();
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(Math.max(c.end, c.start + 0.8))}\n${c.text}\n`).join("\n");
}

/** Masters a mix to -14 LUFS with a -1 dBTP ceiling: measure first, then normalize linearly (two-pass loudnorm). */
export function master(input: string, out: string) {
  const target = "I=-14:TP=-1:LRA=11";
  // loudnorm prints its measurement to stderr.
  const report = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", input, "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  const m = JSON.parse(report.slice(report.lastIndexOf("{"), report.lastIndexOf("}") + 1)) as Record<string, string>;
  const measured = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  ffmpeg(["-i", input, "-af", `loudnorm=${target}:${measured}`, "-ar", "48000", "-c:a", "aac", "-b:a", "192k", out]);
}
