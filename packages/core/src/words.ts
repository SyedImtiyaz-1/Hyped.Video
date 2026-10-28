// Spoken words and caption phrasing, shared by the runner (the voice tool and the reel editor) and the web app's reel
// editor, so the live preview groups words into lines exactly as the render does.

export type Word = { text: string; start: number; end: number };
/** A run of words shown together, of whatever kind of word was grouped. */
export type GroupOf<W extends Word> = { start: number; end: number; text: string; words: W[] };
export type Group = GroupOf<Word>;

export const round = (n: number) => Math.round(n * 1000) / 1000;
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

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
export function groupWords<W extends Word>(words: W[], lineEnds: Set<number>, limits: PhraseLimits = VOICE_PHRASES): GroupOf<W>[] {
  const phrases: W[][] = [];
  let cur: W[] = [];
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
  // A single word that ends a sentence joins the phrase before it when that still fits (never across a line end that
  // was asked for).
  const forced = new Set(words.filter((_, i) => lineEnds.has(i)));
  for (let i = phrases.length - 1; i > 0; i--) {
    const [prev, one] = [phrases[i - 1], phrases[i]];
    const fits = prev.length + one.length <= limits.maxWords + 1 && [...prev, ...one].map((x) => x.text).join(" ").length <= limits.maxChars + 2 && one[0].start - prev[prev.length - 1].end < 0.4;
    if (one.length === 1 && !endsSentence(prev[prev.length - 1].text) && !forced.has(prev[prev.length - 1]) && fits) phrases.splice(i - 1, 2, [...prev, ...one]);
  }
  const groups: GroupOf<W>[] = phrases.map((ws) => ({ start: ws[0].start, end: ws[ws.length - 1].end, text: ws.map((w) => w.text).join(" "), words: ws }));
  // Hold each phrase on screen until the next one starts (up to `hold`), so captions don't flicker off between words.
  for (let i = 0; i < groups.length; i++) groups[i].end = round(Math.min(groups[i + 1]?.start ?? Infinity, groups[i].end + limits.hold));
  return groups;
}

// Letters and digits in any script, for matching words (norm keeps ASCII only, which blanks Devanagari).
export const bare = (s: string) => s.toLocaleLowerCase("en").replace(/[^\p{L}\p{M}\p{N}]/gu, "");

// Words that make a line's key word when the planner gives none: numbers and a few strong words, else the longest real one.
export const POWER = new Set("stop never always secret free best worst money sales double doubled triple fast easy mistake biggest only first last now today save win proven instantly results result".split(" "));
export const STOP = new Set([...WEAK, ..."i you it this they we he she was be so just have has do what here there then than will can about because until before".split(" ")]);

/** A line's strongest word, when the plan gave it none: a number, a power word, else the longest word that isn't filler. */
export function strongestWord(words: { text: string }[]): number | null {
  let [best, top] = [null as number | null, 0];
  words.forEach((w, k) => {
    const n = bare(w.text);
    const digits = /\d/.test(n);
    if (!digits && (n.length < 3 || STOP.has(n))) return;
    const score = (digits ? 20 : POWER.has(n) ? 10 : 0) + Math.min(n.length, 10);
    if (score > top) [best, top] = [k, score];
  });
  return best;
}
