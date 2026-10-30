import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextResponse } from "next/server";
import { bare } from "@launchreel/core/words";

/** The OpenAI key: the process's, or the root .env's (`next dev` runs in web/, and Next reads only web/'s env files). */
function openaiKey(): string | undefined {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const line = readFileSync(resolve(process.cwd(), "..", ".env"), "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("OPENAI_API_KEY="));
    return line?.slice("OPENAI_API_KEY=".length).trim().replace(/^["']|["']$/g, "") || undefined;
  } catch {
    return undefined;
  }
}

// OpenAI takes up to 25 MB of audio a request: about 13 minutes of the 16 kHz mono WAV the editor sends.
const MAX_BYTES = 25 * 1024 * 1024;

type Word = { text: string; start: number; end: number };

/** The recognized words with the full transcript's spelling and punctuation, matched in order (as runner/src/reel.ts). */
function punctuate(words: Word[], text: string): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const out = words.map((w) => ({ ...w }));
  for (let i = 0, j = 0; i < out.length && j < tokens.length; ) {
    const a = bare(out[i].text);
    if (a === bare(tokens[j])) out[i++].text = tokens[j++];
    else if (tokens.slice(j + 1, j + 4).some((t) => bare(t) === a)) j++;
    else i++;
  }
  return out;
}

/**
 * Local development only: the words said in a clip opened from this computer (/dashboard/edit/local), with their
 * timings, so its captions appear at once. OpenAI's whisper-1, as the reel pipeline uses, with the OPENAI_API_KEY of the
 * root .env. Never in a production build, where clips are uploaded and the render Worker hears them.
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const key = openaiKey();
  if (!key) return NextResponse.json({ error: "Add OPENAI_API_KEY to the root .env for captions here." }, { status: 503 });
  const audio = (await req.formData().catch(() => null))?.get("audio");
  if (!(audio instanceof Blob) || !audio.size) return NextResponse.json({ error: "No audio" }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "That's too long to caption here: try a clip under 13 minutes." }, { status: 413 });

  const form = new FormData();
  form.append("file", audio, "speech.wav");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  const res = await fetch(`${(process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "")}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}` },
    body: form,
  }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: `The transcription service didn't answer (${res?.status ?? "offline"}).` }, { status: 502 });
  const out = (await res.json()) as { text?: string; language?: string; words?: { word: string; start: number; end: number }[] };
  const ms = (t: number) => Math.round(t * 1000) / 1000;
  const words = (out.words ?? []).map((w) => ({ text: w.word.trim(), start: ms(w.start), end: ms(w.end) })).filter((w) => w.text);
  return NextResponse.json({ words: punctuate(words, out.text ?? ""), language: out.language ?? null });
}
