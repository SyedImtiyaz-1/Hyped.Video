// Caption and audio helpers shared by the voice tool (voice.ts) and the reel editor (reel.ts): caption phrasing,
// SRT files and loudness mastering.
import { execFileSync, spawnSync } from "node:child_process";

export type Word = { text: string; start: number; end: number };
export type Group = { start: number; end: number; text: string; words: Word[] };

export const round = (n: number) => Math.round(n * 1000) / 1000;
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });

// Words that read badly at the end of a caption phrase, so they move to the start of the next one.
export const WEAK = new Set(["a", "an", "the", "to", "of", "and", "or", "but", "with", "your", "our", "their", "my", "at", "in", "on", "for", "by", "into", "from", "as", "is", "are", "that"]);
export const endsSentence = (w: string) => /[.!?…]["')\]]?$/.test(w);
export const endsClause = (w: string) => /[,;:—–]["')\]]?$/.test(w);

/** How long a caption phrase may get, and how long it stays up after its last word (until the next one starts). */
export type PhraseLimits = { maxWords: number; maxChars: number; maxSeconds: number; pause: number; hold: number };
/** The voice tool's phrases: up to 4 words, about 24 characters, 2.2 s. */
export const VOICE_PHRASES: PhraseLimits = { maxWords: 4, maxChars: 24, maxSeconds: 2.2, pause: 0.5, hold: 0.4 };

/**
 * Short caption phrases (by default up to 4 words, about 24 characters, 2.2 s), breaking at sentence ends, commas,
 * pauses and line ends; a small word like "a" or "your" moves to the next phrase, and a lone last word joins its phrase.
 */
export function groupWords(words: Word[], lineEnds: Set<number>, limits: PhraseLimits = VOICE_PHRASES): Group[] {
  const phrases: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    const hardBreak = !next || lineEnds.has(i) || endsSentence(w.text) || (endsClause(w.text) && cur.length >= 2) || next.start - w.end > limits.pause;
    const full = next && (cur.length >= limits.maxWords || [...cur, next].map((x) => x.text).join(" ").length > limits.maxChars || next.end - cur[0].start > limits.maxSeconds);
    if (hardBreak) {
      phrases.push(cur);
      cur = [];
    } else if (full) {
      const last = cur[cur.length - 1];
      if (cur.length > 1 && WEAK.has(norm(last.text))) {
        phrases.push(cur.slice(0, -1));
        cur = [last];
      } else {
        phrases.push(cur);
        cur = [];
      }
    }
  });
  if (cur.length) phrases.push(cur);
  // A single word that ends a sentence joins the phrase before it when that still fits.
  for (let i = phrases.length - 1; i > 0; i--) {
    const [prev, one] = [phrases[i - 1], phrases[i]];
    const fits = prev.length + one.length <= limits.maxWords + 1 && [...prev, ...one].map((x) => x.text).join(" ").length <= limits.maxChars + 2 && one[0].start - prev[prev.length - 1].end < 0.4;
    if (one.length === 1 && !endsSentence(prev[prev.length - 1].text) && fits) phrases.splice(i - 1, 2, [...prev, ...one]);
  }
  const groups = phrases.map((ws) => ({ start: ws[0].start, end: ws[ws.length - 1].end, text: ws.map((w) => w.text).join(" "), words: ws }));
  // Hold each phrase on screen until the next one starts (up to `hold`), so captions don't flicker off between words.
  for (let i = 0; i < groups.length; i++) groups[i].end = round(Math.min(groups[i + 1]?.start ?? Infinity, groups[i].end + limits.hold));
  return groups;
}

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
