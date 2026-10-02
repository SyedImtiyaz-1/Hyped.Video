"use client";
// Every emoji the render can draw (web/lib/emoji-data.json, from the render's emoji font: scripts/emoji-data.py), found
// by name or keyword, by category, or pasted in. Skin tones and recent picks are remembered in this browser only.
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type EmojiRow = [emoji: string, name: string, keywords: string, category: number, tones: 0 | 1];
type EmojiData = { categories: string[]; emojis: EmojiRow[] };

const CATEGORY_LABEL: Record<string, [label: string, icon: string]> = {
  people: ["Smileys & people", "😀"],
  animals_and_nature: ["Animals & nature", "🐶"],
  food_and_drink: ["Food & drink", "🍔"],
  activity: ["Activity", "⚽"],
  travel_and_places: ["Travel & places", "🚗"],
  objects: ["Objects", "💡"],
  symbols: ["Symbols", "💯"],
  flags: ["Flags", "🏁"],
};
/** What creators reach for most in reels. */
const POPULAR = ["🔥", "💯", "🚀", "💰", "📈", "✅", "❌", "👀", "🤯", "😂", "😱", "🙌", "👏", "💪", "🤝", "✨", "⭐", "🎉", "💡", "⚡", "🎯", "⏰", "📌", "👇", "👉", "🧠", "🤔", "❤️", "😍", "🥳", "😎", "🤑", "💸", "🏆", "⚠️", "🛑"];
const TONES = ["", "🏻", "🏼", "🏽", "🏾", "🏿"];
const TONE_SWATCH = ["#FFCC4D", "#F7DECE", "#F3D2A2", "#D5AB88", "#AF7E57", "#7C533E"];

let data: Promise<EmojiData> | null = null;
const loadData = () => (data ??= import("@/lib/emoji-data.json").then((m) => m.default as unknown as EmojiData));

const store = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
};

/** An emoji with a skin tone: the tone after its first character (in place of a following U+FE0F). */
export function withTone(emoji: string, tone: string): string {
  if (!tone) return emoji;
  const [first, ...rest] = [...emoji];
  return first + tone + (rest[0] === "️" ? rest.slice(1) : rest).join("");
}

const bare = (s: string) => s.replace(/️/g, "");

/** The emoji grid, search and categories. `onPick` gets the emoji as drawn (with the chosen skin tone). */
export function EmojiPicker({ value, onPick, className }: { value?: string | null; onPick: (emoji: string) => void; className?: string }) {
  const [loaded, setLoaded] = useState<EmojiData | null>(null);
  const [query, setQuery] = useState("");
  const [tone, setTone] = useState(() => Number(store.get("hyped:emoji-tone") ?? 0) || 0);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(store.get("hyped:emoji-recent") ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const scroller = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void loadData().then((d) => live && setLoaded(d));
    search.current?.focus();
    return () => {
      live = false;
    };
  }, []);

  const byEmoji = useMemo(() => new Map((loaded?.emojis ?? []).map((row) => [bare(row[0]), row])), [loaded]);
  const toned = (row: EmojiRow) => (row[4] ? withTone(row[0], TONES[tone]) : row[0]);
  const pick = (emoji: string) => {
    onPick(emoji);
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 24);
    setRecent(next);
    store.set("hyped:emoji-recent", JSON.stringify(next));
  };

  // Searching: every word of the query in the name or keywords; a pasted emoji finds itself.
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const pasted = query.trim() ? byEmoji.get(bare(query.trim().replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ""))) : undefined;
  const results = useMemo(() => {
    if (!loaded || !terms.length) return [];
    // The name itself first, then names starting with the words, then a word of the name, then anything else.
    const q = terms.join(" ");
    const rank = (row: EmojiRow) => (row[1] === q ? 0 : row[1].startsWith(q) ? 1 : terms.every((t) => row[1].split(" ").includes(t)) ? 2 : terms.every((t) => row[1].includes(t)) ? 3 : 4);
    return loaded.emojis
      .filter((row) => terms.every((t) => row[1].includes(t) || row[2].includes(t)))
      .map((row, k) => ({ row, k, r: rank(row) }))
      .sort((a, b) => a.r - b.r || a.k - b.k)
      .slice(0, 160)
      .map((x) => x.row);
    // `terms` is derived from `query`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, query]);

  const cell = (emoji: string, name: string, key: string) => (
    <button
      key={key}
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={value === emoji}
      onClick={() => pick(emoji)}
      className={cn("flex size-9 items-center justify-center rounded-md text-[22px] leading-none transition-colors hover:bg-gray-alpha-200", value === emoji && "bg-gray-alpha-300 ring-1 ring-gray-1000")}
    >
      {emoji}
    </button>
  );
  const section = (id: string, label: string, cells: React.ReactNode) => (
    <section key={id} id={`emoji-${id}`} className="pb-2">
      <h3 className="sticky top-0 z-10 bg-background-100 px-1 py-1.5 text-xs font-medium text-gray-900">{label}</h3>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))]">{cells}</div>
    </section>
  );

  return (
    <div className={cn("flex w-full flex-col overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100 shadow-lg", className)}>
      <div className="flex items-center gap-2 border-b border-gray-alpha-400 p-2">
        <label className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md bg-gray-alpha-100 px-2 text-sm">
          <Search className="size-3.5 shrink-0 text-gray-900" />
          <input ref={search} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search, or paste an emoji" aria-label="Search emojis" className="min-w-0 flex-1 bg-transparent text-gray-1000 outline-none placeholder:text-gray-900" />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear the search" className="text-gray-900 hover:text-gray-1000">
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <div className="flex shrink-0 items-center gap-0.5" role="radiogroup" aria-label="Skin tone">
          {TONE_SWATCH.map((color, k) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={tone === k}
              aria-label={k === 0 ? "Default skin tone" : `Skin tone ${k}`}
              onClick={() => {
                setTone(k);
                store.set("hyped:emoji-tone", String(k));
              }}
              className={cn("size-4 rounded-full border border-black/10", tone === k && "ring-2 ring-gray-1000 ring-offset-1 ring-offset-background-100")}
              style={{ background: color }}
            />
          ))}
        </div>
      </div>
      {!terms.length && loaded && (
        <div className="flex gap-0.5 overflow-x-auto border-b border-gray-alpha-400 px-1.5 py-1" role="tablist" aria-label="Emoji categories">
          {[["popular", "Popular in reels", "⭐"] as const, ...(recent.length ? [["recent", "Recently used", "🕘"] as const] : []), ...loaded.categories.map((c) => [c, CATEGORY_LABEL[c]?.[0] ?? c, CATEGORY_LABEL[c]?.[1] ?? "•"] as const)].map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={false}
              title={label}
              aria-label={label}
              onClick={() => scroller.current?.querySelector(`#emoji-${id}`)?.scrollIntoView({ block: "start" })}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-lg hover:bg-gray-alpha-200"
            >
              {icon}
            </button>
          ))}
        </div>
      )}
      <div ref={scroller} className="h-72 overflow-y-auto overscroll-contain px-1.5">
        {!loaded && <p className="p-4 text-center text-sm text-gray-900">Loading emojis…</p>}
        {loaded && terms.length > 0 && (
          <>
            {pasted && section("pasted", "Pasted", cell(toned(pasted), pasted[1], "pasted"))}
            {results.length > 0 ? section("results", `${results.length === 160 ? "160+" : results.length} found`, results.map((row) => cell(toned(row), row[1], row[0]))) : !pasted && <p className="p-4 text-center text-sm text-gray-900">No emoji matches “{query.trim()}”.</p>}
          </>
        )}
        {loaded && !terms.length && (
          <>
            {section(
              "popular",
              "Popular in reels",
              POPULAR.map((e) => {
                const row = byEmoji.get(bare(e));
                return row ? cell(toned(row), row[1], `p${e}`) : null;
              }),
            )}
            {recent.length > 0 && section("recent", "Recently used", recent.map((e) => cell(e, byEmoji.get(bare(e).replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ""))?.[1] ?? e, `r${e}`)))}
            {loaded.categories.map((c, ci) =>
              section(
                c,
                CATEGORY_LABEL[c]?.[0] ?? c,
                loaded.emojis.filter((row) => row[3] === ci).map((row) => cell(toned(row), row[1], row[0])),
              ),
            )}
          </>
        )}
      </div>
    </div>
  );
}
