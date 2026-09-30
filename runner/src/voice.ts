// Voiceover tool for the agent: records the narration, times every word, lays out the voice track and the
// captions, and mixes the voice over the music. Runs inside the render container (bundled as dist/voice.mjs).
//
//   voice speak <script.json> <dir> [video seconds]    record each line; writes <dir>/voice.json (durations, word timings)
//   voice track <voice.json> <placements.json> <dir> [seconds]   <dir>/voice.wav, captions.json, captions.srt
//   voice mix <voice.wav> <music-file | none> <seconds> <out.m4a>   duck the music under the voice, master to -14 LUFS
//   voice frames <video.mp4> <captions.json> <dir>     a still of every line as it's spoken, for the sync check
//
// A script line has `text` (what the voice says, spelled the way it's said) and optionally `show` (how the captions
// write it, when that differs: "autoapply dot in" is shown as "autoapply.in", "seven days" as "7 days").
//
// The voice is fixed by the job (HYPED_VOICE); the agent only writes the words. Speech goes through
// OPENAI_BASE_URL (in the container, the render Worker's proxy adds the key); word timings come from
// HYPED_TIMINGS_URL (the render Worker's speech recognition). Without timings, words are timed by length.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { VoiceId } from "@launchreel/core/voices";

import { groupWords, master, norm, round, srtCues, type Word } from "./media.ts";
import { PROVIDER_VOICES, TTS_MODEL } from "./voice-provider.ts";

type Line = { id: string; text: string; show?: string; file: string; duration: number; words: Word[]; timing: "measured" | "estimated" };

const fail = (msg: string): never => {
  console.error(`voice: ${msg}`);
  process.exit(1);
};
const readJson = <T>(path: string): T => {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (err) {
    return fail(`can't read ${path}: ${(err as Error).message}`);
  }
};
const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
const durationOf = (file: string) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString().trim());

function logUsage(entry: Record<string, number>) {
  if (process.env.HYPED_USAGE_FILE) appendFileSync(process.env.HYPED_USAGE_FILE, `${JSON.stringify(entry)}\n`);
}

/* ---------- speak ---------- */

/** fetch with a deadline: a stalled request is abandoned after `ms` and retried (up to 3 tries in all). */
async function fetchWithRetry(url: string, init: RequestInit, what: string, ms = 60_000): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
      if (res.ok || attempt >= 3 || (res.status < 500 && res.status !== 429)) return res;
    } catch (err) {
      if (attempt >= 3) throw new Error(`${what} didn't respond (${(err as Error).name === "TimeoutError" ? `no answer in ${ms / 1000} s` : (err as Error).message})`);
    }
    console.error(`voice: ${what} was slow or failed; retrying (${attempt + 1}/3)`);
    await new Promise((r) => setTimeout(r, attempt * 2000));
  }
}

async function synthesize(text: string, voice: { voice: string; direction: string }): Promise<Buffer> {
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const key = process.env.OPENAI_API_KEY ?? "added-by-worker"; // in the container the Worker's proxy adds the real key
  const res = await fetchWithRetry(
    `${base}/audio/speech`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model: TTS_MODEL, voice: voice.voice, input: text, instructions: voice.direction, response_format: "wav" }),
    },
    "the speech service",
  ).catch((err: Error) => fail(err.message));
  if (res.ok) return Buffer.from(await res.arrayBuffer());
  const detail = (await res.text()).replace(/\b(?:sk|rk)-[A-Za-z0-9_*.-]{4,}/g, "[key]").slice(0, 300);
  return fail(`speech request failed (${res.status}): ${detail}`);
}

/** Word timings for a recording: the render Worker's recognizer in the container, OpenAI's on a laptop. */
async function recognize(file: string, prompt: string): Promise<Word[] | null> {
  const audio = readFileSync(file);
  try {
    if (process.env.HYPED_TIMINGS_URL) {
      const res = await fetchWithRetry(
        process.env.HYPED_TIMINGS_URL,
        { method: "POST", headers: { "content-type": "audio/wav", "x-hyped-prompt": encodeURIComponent(prompt.slice(0, 800)) }, body: audio },
        "the word-timing service",
        45_000,
      );
      if (!res.ok) throw new Error(`timings ${res.status}`);
      const { words } = (await res.json()) as { words: { word: string; start: number; end: number }[] };
      return words.map((w) => ({ text: w.word.trim(), start: w.start, end: w.end }));
    }
    const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
    const form = new FormData();
    form.append("file", new Blob([audio], { type: "audio/wav" }), basename(file));
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("prompt", prompt.slice(0, 800));
    const res = await fetchWithRetry(`${base}/audio/transcriptions`, { method: "POST", headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY ?? "added-by-worker"}` }, body: form }, "the transcription service", 45_000);
    if (!res.ok) throw new Error(`transcription ${res.status}`);
    const { words } = (await res.json()) as { words?: { word: string; start: number; end: number }[] };
    return words ? words.map((w) => ({ text: w.word.trim(), start: w.start, end: w.end })) : null;
  } catch (err) {
    console.error(`voice: word timings unavailable for ${basename(file)} (${(err as Error).message}); timing words by length`);
    return null;
  }
}

/**
 * Gives every word of the script (with its own spelling and punctuation) a time: words the recognizer heard keep
 * their measured times, and the rest share the gaps between them in proportion to their length.
 */
function align(text: string, heard: Word[] | null, duration: number): { words: Word[]; timing: Line["timing"]; heardShare: number; heardEnd: boolean } {
  const script = text.split(/\s+/).filter(Boolean);
  const times: ({ start: number; end: number } | null)[] = script.map(() => null);
  const matchedIndex = new Set<number>();
  if (heard?.length) {
    // Longest common subsequence on normalized words.
    const a = script.map(norm);
    const b = heard.map((w) => norm(w.text));
    const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--)
      for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    for (let i = 0, j = 0; i < a.length && j < b.length; ) {
      if (a[i] && a[i] === b[j]) {
        times[i] = { start: heard[j].start, end: heard[j].end };
        matchedIndex.add(i);
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
  }
  const matched = times.filter(Boolean).length;
  // Fill runs of unmatched words between anchors (or the recording's ends) by character length.
  for (let i = 0; i < script.length; ) {
    if (times[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < script.length && !times[j]) j++;
    const from = i > 0 ? times[i - 1]!.end : 0;
    const to = j < script.length ? times[j]!.start : duration;
    const weights = script.slice(i, j).map((w) => Math.max(1, norm(w).length) + 1);
    const total = weights.reduce((x, y) => x + y, 0);
    let t = from;
    for (let k = i; k < j; k++) {
      const span = ((to - from) * weights[k - i]) / total;
      times[k] = { start: t, end: t + span * 0.9 };
      t += span;
    }
    i = j;
  }
  // Whether the recognizer heard the line's last content word: the speech model sometimes drops a line's ending.
  let lastWord = script.length - 1;
  while (lastWord >= 0 && !norm(script[lastWord])) lastWord--;
  const heardEnd = lastWord >= 0 && matchedIndex.has(lastWord);
  const words = script.map((w, i) => ({ text: w, start: round(Math.max(0, times[i]!.start)), end: round(Math.max(times[i]!.start + 0.05, times[i]!.end)) }));
  return { words, timing: heard && matched >= Math.ceil(script.length * 0.6) ? "measured" : "estimated", heardShare: script.length ? matched / script.length : 1, heardEnd };
}

async function speak(scriptPath: string, dir: string, videoSeconds?: string) {
  const voiceId = process.env.HYPED_VOICE as VoiceId | undefined;
  const voice = voiceId && PROVIDER_VOICES[voiceId];
  if (!voice) fail("this job has no voiceover voice (HYPED_VOICE is not set)");
  const { lines } = readJson<{ lines: { id: string; text: string; show?: string }[] }>(scriptPath);
  if (!Array.isArray(lines) || !lines.length) fail(`${scriptPath} needs {"lines":[{"id":"01","text":"..."}]}`);
  const ids = new Set<string>();
  for (const l of lines) {
    if (!l.id || !/^[\w-]{1,20}$/.test(l.id) || ids.has(l.id)) fail(`every line needs a unique short id (letters, digits, - or _); got "${l.id}"`);
    if (!l.text?.trim() || l.text.length > 600) fail(`line ${l.id} needs 1-600 characters of text`);
    if (l.show !== undefined && (typeof l.show !== "string" || !l.show.trim() || l.show.length > 600)) fail(`line ${l.id}: "show" must be 1-600 characters, or leave it out`);
    ids.add(l.id);
  }
  mkdirSync(dir, { recursive: true });
  const out: Line[] = [];
  const notes: string[] = [];
  for (const { id, text, show } of lines) {
    // How the captions write the line, when it differs from how it's said. It never changes the recording.
    const shown = show?.trim() && show.trim() !== text.trim() ? show.trim() : undefined;
    if (!shown && /\bdot\s+[a-z]{2,}\b/i.test(text)) notes.push(`line ${id} says "dot": if that's a web address, add "show" with the written form (like autoapply.in) so the captions read right`);
    const file = join(dir, `${id}.wav`);
    const metaFile = join(dir, `${id}.json`);
    const key = createHash("sha256").update(JSON.stringify([TTS_MODEL, voice!.voice, voice!.direction, text.trim()])).digest("hex");
    const cached = existsSync(metaFile) && existsSync(file) ? readJson<Line & { key: string }>(metaFile) : null;
    if (cached?.key === key) {
      out.push({ id, text: cached.text, ...(shown ? { show: shown } : {}), file: basename(file), duration: cached.duration, words: cached.words, timing: cached.timing });
      continue;
    }
    // The speech model sometimes cuts a line short: record it again (3 tries in all) when its ending wasn't heard.
    let line: Line | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const raw = join(dir, `${id}.raw.wav`);
      writeFileSync(raw, await synthesize(text.trim(), voice!));
      // Trim the silence the model leaves at both ends, so each line's timing is exact. 48 kHz mono for the mix.
      const trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04";
      ffmpeg(["-i", raw, "-af", `${trim},areverse,${trim},areverse`, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", file]);
      const duration = round(durationOf(file));
      const heard = await recognize(file, text);
      const { words, timing, heardShare, heardEnd } = align(text.trim(), heard, duration);
      logUsage({ ttsChars: text.length, ttsSeconds: duration, timingSeconds: heard ? duration : 0 });
      line = { id, text: text.trim(), ...(shown ? { show: shown } : {}), file: basename(file), duration, words, timing };
      if (!heard || (heardEnd && heardShare >= 0.7)) break;
      if (attempt < 3) console.error(`voice: line ${id} came back incomplete (heard ${Math.round(heardShare * 100)}% of it${heardEnd ? "" : ", not its last word"}); recording it again`);
      else notes.push(`line ${id} still sounded incomplete after 3 recordings: listen to ${file}, or reword the line and run speak again`);
    }
    writeFileSync(metaFile, JSON.stringify({ ...line!, key }));
    out.push(line!);
  }
  writeFileSync(join(dir, "voice.json"), JSON.stringify({ voice: voiceId, lines: out }, null, 2));
  const total = out.reduce((s, l) => s + l.duration, 0);
  console.log(`Recorded ${out.length} lines, ${total.toFixed(1)} s of speech (voice ${voiceId}). Written: ${join(dir, "voice.json")}`);
  for (const l of out) console.log(`  ${l.id}  ${l.duration.toFixed(2)} s  ${(l.words.length / Math.max(l.duration, 0.1)).toFixed(1)} words/s  ${l.timing === "estimated" ? "(timed by length)  " : ""}${l.text.slice(0, 60)}${l.show ? `  [captions: ${l.show.slice(0, 40)}]` : ""}`);
  // Does the voice fit the video? A moment before the first line, a breath after each one, a beat at the end.
  const target = Number(videoSeconds);
  if (target > 0) {
    const needed = round(0.3 + total + 0.45 * (out.length - 1) + 0.8);
    const pace = voice!.wordsPerSecond;
    if (needed > target * 1.15) console.log(`Too long: the voice needs about ${needed.toFixed(1)} s with breaths for a ${target} s video. Cut about ${Math.ceil((needed - target) * pace)} words (this voice says about ${pace} a second), then run speak again.`);
    else console.log(`Fits: about ${needed.toFixed(1)} s with breaths, for a ${target} s video.`);
  }
  for (const n of notes) console.log(`Note: ${n}`);
}

/* ---------- track ---------- */

/**
 * Times the caption words (a line's `show`) from the spoken ones: words both share keep their times, and each run that
 * differs ("AutoApply dot in" → "autoapply.in", "seven" → "7") takes the time of the spoken run it stands for.
 */
function displayWords(spoken: Word[], show: string): Word[] {
  const shown = show.split(/\s+/).filter(Boolean);
  const a = spoken.map((w) => norm(w.text));
  const b = shown.map(norm);
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const anchors: [number, number][] = [[-1, -1]];
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] && a[i] === b[j]) anchors.push([i++, j++]);
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  anchors.push([spoken.length, shown.length]);
  const out: Word[] = new Array(shown.length);
  for (let k = 0; k < anchors.length - 1; k++) {
    const [i0, j0] = anchors[k];
    const [i1, j1] = anchors[k + 1];
    if (k > 0) out[j0] = { text: shown[j0], start: spoken[i0].start, end: spoken[i0].end };
    const run = shown.slice(j0 + 1, j1);
    if (!run.length) continue;
    const said = spoken.slice(i0 + 1, i1);
    // The spoken words this run replaces; with none (the caption adds a word), squeeze it in at the gap.
    const from = said.length ? said[0].start : i0 >= 0 ? spoken[i0].end : (spoken[0]?.start ?? 0);
    const to = said.length ? said[said.length - 1].end : i1 < spoken.length ? spoken[i1].start : from + 0.2;
    const span = Math.max(to - from, 0.08 * run.length);
    const weights = run.map((w) => Math.max(1, norm(w).length) + 1);
    const total = weights.reduce((x, y) => x + y, 0);
    let t = from;
    run.forEach((w, n) => {
      const d = (span * weights[n]) / total;
      out[j0 + 1 + n] = { text: w, start: round(t), end: round(t + d * 0.95) };
      t += d;
    });
  }
  return out;
}

function track(voicePath: string, placementsPath: string, dir: string, seconds?: string) {
  const voice = readJson<{ lines: Line[] }>(voicePath);
  const placements = readJson<{ id: string; start: number }[]>(placementsPath);
  const byId = new Map(voice.lines.map((l) => [l.id, l]));
  if (!Array.isArray(placements) || !placements.length) fail(`${placementsPath} needs [{"id":"01","start":0.3}, ...]`);
  const placed = placements
    .map((p) => {
      const line = byId.get(p.id) ?? fail(`placements.json names line "${p.id}", which isn't in ${basename(voicePath)}`);
      if (typeof p.start !== "number" || p.start < 0) fail(`line ${p.id} needs a start time in seconds (>= 0)`);
      return { ...line, start: p.start };
    })
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < placed.length; i++) {
    const prev = placed[i - 1];
    const overlap = prev.start + prev.duration + 0.15 - placed[i].start;
    if (overlap > 0) fail(`line ${prev.id} (${prev.duration.toFixed(2)} s from ${prev.start} s) runs into line ${placed[i].id}; start ${placed[i].id} at ${round(prev.start + prev.duration + 0.25)} s or later`);
  }
  const lastEnd = placed[placed.length - 1].start + placed[placed.length - 1].duration;
  const total = seconds ? Number(seconds) : round(lastEnd + 0.8);
  if (!(total > 0)) fail(`the video length must be a number of seconds, got "${seconds}"`);
  if (lastEnd > total) fail(`the voice runs to ${lastEnd.toFixed(2)} s, past the video's ${total} s: shorten a line or lengthen the video`);

  mkdirSync(dir, { recursive: true });
  const src = dirname(resolve(voicePath));
  const inputs = placed.flatMap((l) => ["-i", join(src, l.file)]);
  const delays = placed.map((l, i) => `[${i}:a]adelay=${Math.round(l.start * 1000)}:all=1[d${i}]`).join(";");
  const mixIn = placed.map((_, i) => `[d${i}]`).join("");
  ffmpeg([...inputs, "-filter_complex", `${delays};${mixIn}amix=inputs=${placed.length}:normalize=0:duration=longest,apad=whole_dur=${total},atrim=0:${total}[v]`, "-map", "[v]", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", join(dir, "voice.wav")]);

  // Captions use each line's written form (`show`), timed from its spoken words.
  const shift = (ws: Word[], by: number) => ws.map((w) => ({ text: w.text, start: round(by + w.start), end: round(by + w.end) }));
  const words: Word[] = [];
  const lineEnds = new Set<number>();
  const lines = placed.map((l) => {
    const spoken = shift(l.words, l.start);
    const shown = l.show ? shift(displayWords(l.words, l.show), l.start) : spoken;
    words.push(...shown);
    lineEnds.add(words.length - 1);
    return { id: l.id, text: l.text, show: l.show ?? l.text, start: round(l.start), end: round(l.start + l.duration), words: shown, spoken };
  });
  const groups = groupWords(words, lineEnds);
  writeFileSync(join(dir, "captions.json"), JSON.stringify({ duration: total, lines, words, groups }, null, 2));
  writeFileSync(join(dir, "captions.srt"), srtCues(words, lineEnds));
  console.log(`Voice track: ${join(dir, "voice.wav")} (${total} s). Captions: ${groups.length} phrases in captions.json, ${join(dir, "captions.srt")}.`);
}

/* ---------- frames ---------- */

/** "w0+w0" style xstack offsets: the n-th column or row of equal-sized tiles. */
const tileOffset = (n: number, unit: "w0" | "h0") => (n === 0 ? "0" : new Array(n).fill(unit).join("+"));

/**
 * The sync check: a still of the video while each line is spoken (60% of the way in, when what it names should be on
 * screen), plus the end of the last line, as one contact sheet. The agent looks at it and fixes any line whose scene
 * doesn't show what it says.
 */
function frames(video: string, captionsPath: string, dir: string) {
  if (!existsSync(video)) fail(`no video at ${video}: render it first`);
  const { lines } = readJson<{ lines: { id: string; text: string; show?: string; start: number; end: number }[] }>(captionsPath);
  if (!Array.isArray(lines) || !lines.length) fail(`${captionsPath} has no lines: run track first`);
  mkdirSync(dir, { recursive: true });
  const shots = lines.map((l) => ({ id: l.id, say: l.show ?? l.text, at: round(l.start + (l.end - l.start) * 0.6), what: "while it's said" }));
  const last = lines[lines.length - 1];
  shots.push({ id: last.id, say: last.show ?? last.text, at: round(Math.max(last.start, last.end - 0.1)), what: "as it ends" });
  const files = shots.map((shot, i) => {
    const file = join(dir, `${String(i + 1).padStart(2, "0")}-line-${shot.id}.jpg`);
    ffmpeg(["-ss", String(shot.at), "-i", video, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", file]);
    return file;
  });
  const sheet = join(dir, "check.jpg");
  const cols = Math.min(3, files.length);
  const layout = files.map((_, i) => `${tileOffset(i % cols, "w0")}_${tileOffset(Math.floor(i / cols), "h0")}`).join("|");
  ffmpeg([...files.flatMap((f) => ["-i", f]), "-filter_complex", `${files.map((_, i) => `[${i}:v]`).join("")}xstack=inputs=${files.length}:layout=${layout}:fill=black`, "-q:v", "3", sheet]);
  const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
  console.log(`Sync check: look at ${sheet} (left to right, top to bottom; each still is also in ${dir}):`);
  shots.forEach((shot, i) => console.log(`  ${i + 1}. ${clock(shot.at)}  line ${shot.id} ${shot.what}: "${shot.say}"`));
  console.log(
    "For each still: what the line names (a feature, a number, the product, the web address) is on screen and readable; the on-screen words agree with the line, never a different phrase for the same idea; and in the last still the web address or call to action is on screen. Fix any scene that fails, render again, and rerun this check.",
  );
}

/* ---------- mix ---------- */

function mix(voiceWav: string, music: string, seconds: string, out: string) {
  const total = Number(seconds);
  if (!(total > 0)) fail(`the video length must be a number of seconds, got "${seconds}"`);
  if (!existsSync(voiceWav)) fail(`no voice track at ${voiceWav} (run track first)`);
  const premix = out.replace(/\.[a-z0-9]+$/i, "") + ".premix.wav";
  if (music === "none") {
    ffmpeg(["-i", voiceWav, "-filter_complex", `[0:a]apad=whole_dur=${total},atrim=0:${total}[out]`, "-map", "[out]", "-ar", "48000", premix]);
  } else {
    if (!existsSync(music)) fail(`no music file at ${music}`);
    const fadeOut = Math.max(0, total - 1.5);
    // The voice drives a sidechain compressor on the music: about 15-18 dB of ducking while someone speaks,
    // easing back up between lines. The music loops if it's shorter than the video.
    const graph = [
      `[0:a]atrim=0:${total},asetpts=N/SR/TB,afade=t=in:d=0.3,afade=t=out:st=${fadeOut}:d=1.5,volume=0.55[bed]`,
      `[1:a]apad=whole_dur=${total},atrim=0:${total},asplit=2[vo][key]`,
      `[bed][key]sidechaincompress=threshold=0.012:ratio=14:attack=120:release=450:makeup=1[duck]`,
      `[duck][vo]amix=inputs=2:duration=first:normalize=0[out]`,
    ].join(";");
    ffmpeg(["-stream_loop", "-1", "-i", music, "-i", voiceWav, "-filter_complex", graph, "-map", "[out]", "-t", String(total), "-ar", "48000", premix]);
  }
  master(premix, out);
  console.log(`Mixed ${out} (${total} s, mastered to -14 LUFS, -1 dBTP).`);
}

/* ---------- cli ---------- */

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "speak" && (args.length === 2 || args.length === 3)) await speak(args[0], args[1], args[2]);
else if (cmd === "track" && args.length >= 3) track(args[0], args[1], args[2], args[3]);
else if (cmd === "mix" && args.length === 4) mix(args[0], args[1], args[2], args[3]);
else if (cmd === "frames" && args.length === 3) frames(args[0], args[1], args[2]);
else {
  console.log("usage:\n  voice speak <script.json> <dir> [video seconds]\n  voice track <voice.json> <placements.json> <dir> [seconds]\n  voice mix <voice.wav> <music-file|none> <seconds> <out.m4a>\n  voice frames <video.mp4> <captions.json> <dir>");
  process.exit(cmd ? 1 : 0);
}
