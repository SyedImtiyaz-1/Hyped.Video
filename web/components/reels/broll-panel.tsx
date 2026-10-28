"use client";
import { Clapperboard, LoaderCircle, Plus, Repeat2, Search, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BROLL_LENGTH, BROLL_SOURCES, longestShot, sameClip, type BrollClip, type BrollShot } from "@launchreel/core/broll";
import { cn } from "@/lib/cn";

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const seconds = (s: number) => `${s.toFixed(1)} s`;

export type BrollActions = {
  /** Lays a clip at the playhead; why not, when there's no room there. */
  add: (clip: BrollClip, query: string) => string | null;
  /** Another clip for a shot: same moment, same length as far as the new clip allows. */
  swap: (index: number, clip: BrollClip, query: string) => void;
  setLength: (index: number, length: number) => void;
  remove: (index: number) => void;
  removeAll: () => void;
  /** Goes to a shot. */
  select: (index: number) => void;
};

/** A shot as the panel lists it: the stored shot, when it plays in the reel (the cut clock; null when it doesn't), and how long it may get. */
export type BrollRow = { shot: BrollShot; at: number | null; length: number; most: number };

type Searching = { mode: "add" } | { mode: "swap"; index: number };

/**
 * Stock B-roll: short clips from a free library (Pixabay or Pexels) that play over the speaker while they keep talking
 * (the voice and the captions carry on). Every shot can be swapped for another clip, made longer or shorter, or removed;
 * a new one goes in at the playhead. Searches go through the server (it holds the library's key). The library and each
 * videographer are credited here, as the libraries ask.
 */
export function BrollPanel({ jobId, rows, portrait, time, current, selected, actions }: { jobId: string; rows: BrollRow[]; portrait: boolean; time: number; current: number; selected: number | null; actions: BrollActions }) {
  const [searching, setSearching] = useState<Searching | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BrollClip[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const playing = rows.filter((r) => r.at !== null).length;

  const search = async (q: string) => {
    const text = q.replace(/\s+/g, " ").trim();
    if (text.length < 2) return setError("Type a couple of words to search for.");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reels/${jobId}/broll`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: text, portrait }) }).catch(() => null);
    const body = res ? ((await res.json().catch(() => ({}))) as { clips?: BrollClip[]; error?: string }) : { error: "You're offline. Try again in a moment." };
    setBusy(false);
    if (!res?.ok || !body.clips) return setError(body.error ?? "The search didn't work. Try again in a moment.");
    setResults(body.clips);
    if (!body.clips.length) setError(`Nothing found for "${text}". Try other words.`);
  };
  const open = (next: Searching, q = "") => {
    setSearching(next);
    setQuery(q);
    setResults(null);
    setError(null);
    if (q) void search(q);
  };
  const close = () => {
    setSearching(null);
    setResults(null);
    setError(null);
  };
  useEffect(() => {
    if (searching) input.current?.focus();
  }, [searching]);
  // The shot being swapped went away (undo, or removed): stop swapping it.
  useEffect(() => {
    if (searching?.mode === "swap" && !rows[searching.index]) close();
  }, [rows, searching]);

  const pick = (clip: BrollClip) => {
    if (!searching) return;
    if (searching.mode === "swap") actions.swap(searching.index, clip, query.trim());
    else {
      const problem = actions.add(clip, query.trim());
      if (problem) return setError(problem);
    }
    close();
  };

  const swapRow = searching?.mode === "swap" ? (rows[searching.index] ?? null) : null;
  const swapping = swapRow?.shot ?? null;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-alpha-400 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-1000">
          <Clapperboard className="size-3.5" />
          {rows.length ? (rows.length === 1 ? "1 shot of stock footage" : `${rows.length} shots of stock footage`) : "No B-roll yet"}
        </p>
        <p className="mt-0.5 text-xs text-gray-900">Short clips that play over you while you keep talking; the captions stay on top. They play in the preview too.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => (current >= 0 ? open({ mode: "swap", index: current }, rows[current].shot.query) : open({ mode: "add" }))}
            className="flex h-8 items-center gap-1.5 rounded-md bg-gray-1000 px-3 text-[13px] font-medium text-background-100"
          >
            {current >= 0 ? <Repeat2 className="size-3.5" /> : <Plus className="size-3.5" />}
            {current >= 0 ? "Swap the shot playing here" : `Add at ${clock(time)}`}
          </button>
          {rows.length > 1 && (
            <button type="button" onClick={actions.removeAll} className="flex h-8 items-center gap-1.5 rounded-md border border-gray-alpha-400 px-2.5 text-[13px] text-gray-1000 hover:bg-gray-alpha-100">
              <Trash2 className="size-3.5" />
              Remove all
            </button>
          )}
        </div>
      </div>

      {searching && (
        <div className="rounded-lg border border-gray-alpha-400 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-gray-1000">{swapRow ? `Swap the shot at ${clock(swapRow.at ?? 0)}` : `New shot at ${clock(time)}`}</p>
            <button type="button" onClick={close} aria-label="Close the search" className="flex size-7 items-center justify-center rounded-md text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000">
              <X className="size-4" />
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search(query);
            }}
            className="flex gap-1.5"
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-900" />
              <input
                ref={input}
                value={query}
                maxLength={80}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Like “typing on a laptop” or “city at night”"
                aria-label="Search stock footage"
                className="h-9 w-full rounded-md border border-gray-alpha-400 bg-background-100 pl-8 pr-2.5 text-sm text-gray-1000 placeholder:text-gray-700 focus:border-gray-alpha-600 focus:outline-none focus:ring-4 focus:ring-gray-alpha-200"
              />
            </div>
            <button type="submit" disabled={busy} className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-gray-1000 px-3 text-[13px] font-medium text-background-100 disabled:opacity-60">
              {busy && <LoaderCircle className="size-3.5 animate-spin" />}
              Search
            </button>
          </form>
          {error && (
            <p className="mt-2 text-[13px] text-red-900" role="status">
              {error}
            </p>
          )}
          {results && results.length > 0 && (
            <>
              <div className={cn("mt-3 grid gap-1.5", portrait ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
                {results.map((clip) => {
                  const short = longestShot(clip) < BROLL_LENGTH.min;
                  const same = swapping ? sameClip(swapping.clip, clip) : false;
                  return (
                    <button
                      key={`${clip.source}-${clip.id}`}
                      type="button"
                      disabled={short || same}
                      onClick={() => pick(clip)}
                      title={short ? "Too short to use" : `By ${clip.author || `a ${BROLL_SOURCES[clip.source].label} videographer`}`}
                      className={cn("group relative overflow-hidden rounded-md bg-gray-alpha-200 outline-none ring-gray-1000 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50", portrait ? "aspect-[9/16]" : "aspect-video", same && "ring-2")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- the library's own still, sized by the library */}
                      <img src={clip.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105" />
                      <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 text-[10px] tabular-nums text-white">{Math.round(clip.duration)} s</span>
                      {same && <span className="absolute left-1 top-1 rounded bg-black/65 px-1 text-[10px] text-white">Now</span>}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-gray-900">
                Videos from{" "}
                <a href={BROLL_SOURCES[results[0].source].home} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {BROLL_SOURCES[results[0].source].label}
                </a>
                . Pick one to {swapping ? "swap it in" : "lay it at the playhead"}.
              </p>
            </>
          )}
        </div>
      )}

      {rows.length === 0 && !searching && <p className="text-[13px] text-gray-900">Move the playhead to a moment that talks about something you could show, then add a shot there.</p>}
      {rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((row, i) => {
            const { shot } = row;
            return (
              <li key={`${shot.clip.source}-${shot.clip.id}-${shot.at}`} className={cn("flex gap-2.5 rounded-lg border border-gray-alpha-400 p-2", (i === selected || i === current) && "bg-gray-alpha-100 ring-1 ring-gray-alpha-400")}>
                <button type="button" onClick={() => actions.select(i)} className={cn("relative shrink-0 overflow-hidden rounded bg-gray-alpha-200", portrait ? "h-16 w-9" : "h-9 w-16")} aria-label={`Go to the shot at ${clock(row.at ?? 0)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the library's own still */}
                  <img src={shot.clip.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => actions.select(i)} className="shrink-0 text-xs tabular-nums text-gray-900 hover:text-gray-1000" title="Go to it">
                      {row.at === null ? "—" : clock(row.at)}
                    </button>
                    <span className="min-w-0 truncate text-[13px] text-gray-1000">{shot.query || "Stock clip"}</span>
                    <button type="button" onClick={() => open({ mode: "swap", index: i }, shot.query)} className="ml-auto flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000">
                      <Repeat2 className="size-3.5" />
                      Swap
                    </button>
                    <button type="button" onClick={() => actions.remove(i)} aria-label={`Remove the shot at ${clock(row.at ?? 0)}`} className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-900 hover:bg-gray-alpha-100 hover:text-red-900">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  {row.at === null ? (
                    <p className="mt-1 text-xs text-amber-900">Doesn&apos;t play: it overlaps the shot before it, or the end. Remove it or swap that one.</p>
                  ) : (
                    <label className="mt-1 flex items-center gap-2 text-xs text-gray-900">
                      <span className="sr-only">Length</span>
                      <input type="range" min={BROLL_LENGTH.min} max={Math.max(BROLL_LENGTH.min, row.most)} step={0.1} value={Math.min(row.length, row.most)} disabled={row.most <= BROLL_LENGTH.min} onChange={(e) => actions.setLength(i, Number(e.target.value))} className="h-1 min-w-0 flex-1 accent-[var(--ds-gray-1000)]" aria-label={`Length of the shot at ${clock(row.at)}`} />
                      <span className="w-10 shrink-0 text-right tabular-nums">{seconds(row.length)}</span>
                    </label>
                  )}
                  <p className="mt-1 truncate text-[11px] text-gray-900">
                    <a href={shot.clip.page} target="_blank" rel="noreferrer" className="hover:underline">
                      {shot.clip.author ? `${shot.clip.author} on ${BROLL_SOURCES[shot.clip.source].label}` : `On ${BROLL_SOURCES[shot.clip.source].label}`}
                    </a>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
