"use client";
import { ArrowLeft, Check, LoaderCircle, Pause, Play, Redo2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captionLines, cueOf, lineOfWord, resolveLook, type ReelLookChanges, type ReelStyle } from "@launchreel/core/captions";
import { EFFECTS, effectsAt, type PlacedEffect } from "@launchreel/core/effects";
import type { ReelPicture } from "@launchreel/core/picture";
import type { EmojiStyle, ReelEdit, ReelExport, ReelFont, ZoomStrength } from "@launchreel/core/reel";
import type { ReelSound } from "@launchreel/core/sounds";
import { punchAt, soundCues, zoomAim, zoomWindows } from "@launchreel/core/timeline";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { AudioPanel, type SoundActions } from "./audio-panel";
import { EffectsPanel, type EffectActions } from "./effects-panel";
import { EmojiPanel, type EmojiActions } from "./emoji-panel";
import { FiltersPanel } from "./filters-panel";
import { FontPicker } from "./font-picker";
import { LiveCaptions, lineAt } from "./live-captions";
import { LookEditor } from "./look-editor";
import { PictureLayers, useVideoFilter, viewTransform } from "./picture-layers";
import { ReelTimeline, type TimelineItem } from "./reel-timeline";
import { CuePlayer, preloadSounds } from "./sfx-player";
import { StylePicker } from "./style-picker";
import { soundOfWord, TranscriptEditor, WordPanel, type WordActions } from "./transcript-editor";

/** What the editor changes besides the edit itself: the style and its look, the big words' fonts, and the extras. */
export type EditorOptions = { style: ReelStyle; look: ReelLookChanges; fonts: ReelFont[]; emojis: boolean; zooms: boolean; sfx: boolean; hook: boolean };
type Draft = { options: EditorOptions; edit: ReelEdit };
type History = { past: Draft[]; present: Draft; future: Draft[]; group?: string; at?: number };

const TABS = ["Style", "Text", "Emojis", "Effects", "Filters", "Audio"] as const;
type Tab = (typeof TABS)[number];
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);
const ms = (t: number) => Math.round(t * 1000) / 1000;

/**
 * The reel editor: the reel's clean preview with everything drawn live as the render will make it (captions, emojis,
 * punch-ins, transitions and effects, the filter and overlays, and the sound effects), a timeline, and panels for every
 * change. Words can be edited right on the video. Export renders it again (free while the upload is kept).
 */
export function ReelEditor({
  jobId,
  name,
  options,
  edit,
  previewUrl,
  initialExport,
  editableUntil,
  startAt,
}: {
  jobId: string;
  name: string;
  options: EditorOptions;
  edit: ReelEdit;
  previewUrl: string;
  initialExport: ReelExport | null;
  editableUntil: string;
  /** Opened from the reel's page at this second: the editor starts there, with that moment's caption open to edit. */
  startAt?: number;
}) {
  const router = useRouter();
  const [history, setHistory] = useState<History>({ past: [], present: { options, edit }, future: [] });
  const [exported, setExported] = useState<Draft>({ options, edit });
  const draft = history.present;
  const [tab, setTab] = useState<Tab>("Style");
  const [selected, setSelected] = useState<number | null>(null);
  const [exportState, setExportState] = useState<ReelExport | null>(initialExport);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Editing right on the video: a word (or the hook), and what it said before, for Escape.
  const [inline, setInline] = useState<{ word: number; original: string } | { hook: true; original: string } | null>(null);

  /** A change to the draft, undoable; changes in the same `group` within a second (typing, a slider) undo together. */
  const update = useCallback((change: (d: Draft) => Draft, group?: string) => {
    setHistory((h) => {
      const next = change(h.present);
      if (same(next, h.present)) return h;
      const merge = group && h.group === group && Date.now() - (h.at ?? 0) < 1000;
      return { past: merge ? h.past : [...h.past.slice(-79), h.present], present: next, future: [], group, at: Date.now() };
    });
  }, []);
  const undo = () => setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  const redo = () => setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  const setOptions = (patch: Partial<EditorOptions>, group?: string) => update((d) => ({ ...d, options: { ...d.options, ...patch } }), group);
  const setEdit = (change: (e: ReelEdit) => ReelEdit, group?: string) => update((d) => ({ ...d, edit: change(d.edit) }), group);

  // Undo and redo from the keyboard, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" || (e.target as HTMLElement).closest("input, textarea")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Leaving with edits that weren't exported asks first.
  const dirty = !same(draft, exported);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // What the render will do, from the same code (packages/core): the lines, punch-ins and sounds.
  const look = useMemo(() => resolveLook(draft.options.style, draft.options.look), [draft.options.style, draft.options.look]);
  const lines = useMemo(() => captionLines(draft.edit.words, draft.options.style, look, draft.edit), [draft.edit, draft.options.style, look]);
  const windows = useMemo(() => (draft.options.zooms ? zoomWindows(draft.edit, lines) : []), [draft.edit, lines, draft.options.zooms]);
  const hookShown = draft.options.hook && Boolean(draft.edit.hook);
  const cues = useMemo(() => (draft.options.sfx ? soundCues(draft.edit, hookShown) : []), [draft.edit, draft.options.sfx, hookShown]);
  const sounds = useRef(new CuePlayer());
  sounds.current.cues = cues;
  useEffect(() => preloadSounds(cues), [cues]);

  // The player: the time comes from the video every frame while it plays; sound effects follow it.
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const v = video.current;
      if (v) {
        setTime(v.currentTime);
        sounds.current.tick(v.currentTime, !v.paused);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      sounds.current.reset();
    };
  }, [playing]);
  const seek = (t: number) => {
    const clamped = Math.max(0, Math.min(draft.edit.duration, t));
    if (video.current) video.current.currentTime = clamped;
    sounds.current.reset();
    setTime(clamped);
  };
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  // The frame's width in pixels (blur and colour split are shares of it).
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(300);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const resize = new ResizeObserver(() => setFrameWidth(el.clientWidth));
    resize.observe(el);
    return () => resize.disconnect();
  }, []);
  const fx = effectsAt(draft.edit.effects, time);
  const zoom = 1 + (draft.options.zooms ? punchAt(windows, time) : 0) + fx.zoom;
  const { filter, svg } = useVideoFilter(draft.edit.picture, fx, frameWidth);

  /** A moment to show a word at: as it's said, on its line. */
  const timeOfWord = (word: number) => {
    const cue = cueOf(draft.edit.words, word);
    const li = lineOfWord(lines, word);
    return li < 0 ? cue : Math.min(lines[li].end - 0.02, Math.max(lines[li].start + 0.01, cue + 0.01));
  };
  const behind = draft.options.style === "behind";

  const wordActions: WordActions = {
    select: (word) => {
      setSelected(word);
      seek(timeOfWord(word));
    },
    setText: (word, text) => setEdit((e) => ({ ...e, words: e.words.map((w, i) => (i === word ? { ...w, text } : w)) })),
    // "Behind you" has one big word a line: highlighting one takes the line's other back.
    toggleKeyword: (word) =>
      setEdit((e) => {
        if (e.keywords.includes(word)) return { ...e, keywords: e.keywords.filter((k) => k !== word) };
        const li = lineOfWord(lines, word);
        const others = behind && li >= 0 ? new Set(lines[li].words.map((w) => w.i)) : new Set<number>();
        return { ...e, keywords: [...e.keywords.filter((k) => !others.has(k)), word].sort((a, b) => a - b) };
      }),
    toggleHidden: (word) =>
      setEdit((e) => {
        if (e.hidden.includes(word)) return { ...e, hidden: e.hidden.filter((h) => h !== word) };
        // At least one word stays in the captions.
        return e.hidden.length + 1 >= e.words.length ? e : { ...e, hidden: [...e.hidden, word].sort((a, b) => a - b) };
      }),
    hideWords: (words) => setEdit((e) => ({ ...e, hidden: [...new Set([...e.hidden, ...words])].sort((a, b) => a - b).slice(0, e.words.length - 1) })),
    toggleBreak: (word) => setEdit((e) => ({ ...e, breaks: e.breaks.includes(word) ? e.breaks.filter((b) => b !== word) : [...e.breaks, word].sort((a, b) => a - b) })),
    setEmoji: (word, emoji) => setEdit((e) => ({ ...e, emojis: [...e.emojis.filter((x) => x.word !== word), ...(emoji ? [{ word, emoji }] : [])].sort((a, b) => a.word - b.word) })),
    setZoom: (word, strength: ZoomStrength | null) => setEdit((e) => ({ ...e, zooms: [...e.zooms.filter((z) => z.word !== word), ...(strength ? [{ word, strength }] : [])].sort((a, b) => a.word - b.word) })),
    setSound: (word, sound) =>
      setEdit((e) => {
        const at = cueOf(e.words, word);
        const i = soundOfWord(e, word);
        const rest = e.sounds.filter((_, k) => k !== i);
        return { ...e, sounds: [...rest, ...(sound ? [{ at, sound }] : [])].sort((a, b) => a.at - b.at) };
      }),
    addEffect: (word, effect) => addEffect(effect, cueOf(draft.edit.words, word), true),
  };

  // Effects come with their sound (when sound effects are on and the moment has none), and take it along.
  const pairedSound = (e: ReelEdit, effect: PlacedEffect) => e.sounds.findIndex((s) => Math.abs(s.at - effect.at) < 0.001 && s.sound === EFFECTS[effect.effect].sound);
  function addEffect(effect: PlacedEffect["effect"], at: number, withSound: boolean) {
    const spec = EFFECTS[effect];
    setEdit((e) => {
      const placed = { at: ms(at), effect, length: spec.length };
      const sound = withSound && draft.options.sfx && spec.sound && !e.sounds.some((s) => Math.abs(s.at - placed.at) < 0.15) ? [{ at: placed.at, sound: spec.sound }] : [];
      return { ...e, effects: [...e.effects, placed].sort((a, b) => a.at - b.at), sounds: [...e.sounds, ...sound].sort((a, b) => a.at - b.at) };
    });
  }
  const effectActions: EffectActions = {
    add: addEffect,
    addAtCuts: (effect, withSound) =>
      setEdit((e) => {
        const spec = EFFECTS[effect];
        const fresh = e.cuts.filter((c) => !e.effects.some((x) => Math.abs(x.at - c) < 0.05)).map((c) => ({ at: c, effect, length: spec.length }));
        const sound = withSound && draft.options.sfx && spec.sound ? fresh.filter((f) => !e.sounds.some((s) => Math.abs(s.at - f.at) < 0.15)).map((f) => ({ at: f.at, sound: spec.sound! })) : [];
        return { ...e, effects: [...e.effects, ...fresh].sort((a, b) => a.at - b.at), sounds: [...e.sounds, ...sound].sort((a, b) => a.at - b.at) };
      }),
    change: (index, patch) =>
      setEdit((e) => {
        const old = e.effects[index];
        const paired = pairedSound(e, old);
        const next = { ...old, ...patch };
        const sounds = paired >= 0 && (patch.at !== undefined || patch.effect) ? e.sounds.map((s, k) => (k === paired ? { at: next.at, sound: EFFECTS[next.effect].sound ?? s.sound } : s)) : e.sounds;
        return { ...e, effects: e.effects.map((x, k) => (k === index ? next : x)).sort((a, b) => a.at - b.at), sounds: [...sounds].sort((a, b) => a.at - b.at) };
      }, patch.length !== undefined ? `effect-length-${index}` : undefined),
    remove: (index) =>
      setEdit((e) => {
        const paired = pairedSound(e, e.effects[index]);
        return { ...e, effects: e.effects.filter((_, k) => k !== index), sounds: e.sounds.filter((_, k) => k !== paired) };
      }),
    seek,
  };
  const soundActions: SoundActions = {
    add: (at, sound) => setEdit((e) => ({ ...e, sounds: [...e.sounds, { at: ms(at), sound }].sort((a, b) => a.at - b.at) })),
    change: (index, patch) => setEdit((e) => ({ ...e, sounds: e.sounds.map((s, k) => (k === index ? { ...s, ...patch } : s)).sort((a, b) => a.at - b.at) })),
    remove: (index) => setEdit((e) => ({ ...e, sounds: e.sounds.filter((_, k) => k !== index) })),
    setHookSound: (hookSound: ReelSound | null) => setEdit((e) => ({ ...e, hookSound })),
    setOn: (sfx) => setOptions({ sfx }),
    seek,
  };
  const emojiActions: EmojiActions = {
    set: wordActions.setEmoji,
    setStyle: (patch: Partial<EmojiStyle>) => setEdit((e) => ({ ...e, emojiStyle: { ...e.emojiStyle, ...patch } })),
    setOn: (emojis) => setOptions({ emojis }),
    seek,
  };
  const setPicture = (patch: Partial<ReelPicture>, group?: string) => setEdit((e) => ({ ...e, picture: { ...e.picture, ...patch } }), group);

  // Editing on the video: click a word (or the hook) and it pauses, with an edit bar under the picture. The Text tab
  // follows along, so both ways of editing stay in step.
  const editWord = (word: number) => {
    video.current?.pause();
    setSelected(word);
    setTab("Text");
    setInline({ word, original: draft.edit.words[word].text });
  };
  const editHook = () => {
    video.current?.pause();
    setTab("Text");
    setInline({ hook: true, original: draft.edit.hook });
  };
  const closeInline = (revert = false) => {
    if (inline && "word" in inline) {
      const now = draft.edit.words[inline.word].text.replace(/\s+/g, " ").trim();
      // A word can't be left empty: it goes back to what it was.
      if (revert || !now) setEdit((e) => ({ ...e, words: e.words.map((w, i) => (i === inline.word ? { ...w, text: inline.original } : w)) }), `inline-${inline.word}`);
      else if (now !== draft.edit.words[inline.word].text) setEdit((e) => ({ ...e, words: e.words.map((w, i) => (i === inline.word ? { ...w, text: now } : w)) }), `inline-${inline.word}`);
    } else if (inline && revert) setEdit((e) => ({ ...e, hook: inline.original }), "hook");
    setInline(null);
  };
  // While a word is edited on the video, keep it on screen: a longer word can move it to another line.
  useEffect(() => {
    if (!inline || !("word" in inline) || playing) return;
    const li = lineOfWord(lines, inline.word);
    if (li >= 0 && !(time >= lines[li].start && time < lines[li].end)) seek(timeOfWord(inline.word));
    // When the lines change under the word being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  // Opened at a moment from the reel's page: start there, with that caption open to edit.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current || startAt === undefined || !Number.isFinite(startAt)) return;
    opened.current = true;
    const t = Math.max(0, Math.min(draft.edit.duration, startAt));
    const at = lineAt(lines, t) ?? lineAt(lines, t + 0.3);
    seek(at ? Math.max(t, at.line.start + 0.05) : t);
    if (at) editWord(at.line.words[0].i);
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A piece picked on the timeline: go there and open what edits it.
  const pick = (item: TimelineItem) => {
    if (item.kind === "line" || item.kind === "zoom" || item.kind === "emoji") {
      wordActions.select(item.word);
      setTab(item.kind === "emoji" ? "Emojis" : "Text");
    } else if (item.kind === "effect") {
      seek(Math.max(0, draft.edit.effects[item.index].at - 0.6));
      setTab("Effects");
    } else {
      seek(Math.max(0, draft.edit.sounds[item.index].at - 0.6));
      setTab("Audio");
    }
  };

  // Export, then follow it until the new video is in.
  const rendering = exportState?.status === "rendering";
  useEffect(() => {
    if (!rendering) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/reels/${jobId}/export`).catch(() => null);
      const body = res?.ok ? ((await res.json()) as { export: ReelExport | null }) : null;
      if (body?.export && body.export.status !== "rendering") {
        setExportState(body.export);
        router.refresh();
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [rendering, jobId, router]);
  const exportVideo = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/reels/${jobId}/export`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) }).catch(() => null);
    const body = res ? ((await res.json().catch(() => ({}))) as { export?: ReelExport; error?: string }) : { error: "You're offline. Try again in a moment." };
    setBusy(false);
    if (!res?.ok || !body.export) return setError(body.error ?? "The export couldn't start. Try again in a moment.");
    setExportState(body.export);
    setExported(draft);
  };

  const until = new Date(editableUntil).toLocaleDateString("en", { day: "numeric", month: "short" });
  const keyName = behind ? "big word" : "highlight";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
      {/* The bar: back, name, undo and redo, export. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ButtonLink href={`/dashboard/videos/${jobId}`} variant="tertiary" size="sm" aria-label="Back to the reel">
          <ArrowLeft />
        </ButtonLink>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium text-gray-1000">Edit reel</h1>
          <p className="truncate text-xs text-gray-900">
            {name} · free exports until {until}
          </p>
        </div>
        <Button variant="tertiary" size="sm" onClick={undo} disabled={!history.past.length} aria-label="Undo">
          <Undo2 />
        </Button>
        <Button variant="tertiary" size="sm" onClick={redo} disabled={!history.future.length} aria-label="Redo">
          <Redo2 />
        </Button>
        <Button variant="primary" onClick={exportVideo} disabled={busy || rendering || (!dirty && exportState?.status !== "failed")}>
          {busy || rendering ? <LoaderCircle className="animate-spin" /> : <Check />}
          {rendering ? "Exporting…" : "Export video"}
        </Button>
      </div>
      {(error || exportState) && (
        <p className={cn("mb-4 rounded-md border px-3 py-2 text-[13px]", error || exportState?.status === "failed" ? "border-red-500/40 text-red-900" : "border-gray-alpha-400 text-gray-1000")} role="status">
          {error ??
            (exportState?.status === "rendering"
              ? "Exporting your edits. It takes a minute or two; you can keep editing or leave this page."
              : exportState?.status === "done"
                ? dirty
                  ? "You have changes since the last export."
                  : "Exported: the reel's video now has your edits."
                : `The last export failed${exportState?.error ? `: ${exportState.error}` : ""}. Try again.`)}
          {exportState?.status === "done" && !dirty && !error && (
            <a href={`/dashboard/videos/${jobId}`} className="ml-2 font-medium underline underline-offset-2">
              View the reel
            </a>
          )}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* The preview: the clean video with everything the render adds, drawn live. */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div ref={frameRef} className="relative mx-auto aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-xl bg-black sm:max-w-[300px] lg:max-w-[340px]">
            {svg}
            <video
              ref={video}
              src={previewUrl}
              playsInline
              preload="auto"
              className="absolute inset-0 size-full object-cover"
              style={{ ...viewTransform(zoom, fx.dx, fx.dy, zoomAim(9, 16)), filter }}
              onClick={toggle}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onSeeked={(e) => setTime(e.currentTarget.currentTime)}
              onTimeUpdate={(e) => !playing && setTime(e.currentTarget.currentTime)}
            />
            <PictureLayers picture={draft.edit.picture} fx={fx} animate={playing} />
            <LiveCaptions
              look={look}
              options={draft.options}
              edit={draft.edit}
              lines={lines}
              time={time}
              onWord={editWord}
              onHook={editHook}
              onMove={(offset, done) => update((d) => ({ ...d, options: { ...d.options, look: { ...d.options.look, offset: offset || undefined } } }), done ? "move-done" : "move")}
              selected={inline && "word" in inline ? inline.word : null}
            />
            {/* Paused: a small play button in the corner, clear of the captions being edited, and how to edit. */}
            {!playing && !inline && (
              <>
                <button type="button" onClick={toggle} className="absolute left-2 top-2 flex size-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm" aria-label="Play">
                  <Play className="ml-0.5 size-4 fill-current" />
                </button>
                <span className="pointer-events-none absolute right-2 top-2.5 max-w-[calc(100%-3.75rem)] truncate rounded-full bg-black/55 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm">
                  Click a caption to edit<span className="hidden sm:inline"> · drag to move</span>
                </span>
              </>
            )}
          </div>
          {inline && (
            <InlineEditor
              key={"word" in inline ? `w${inline.word}` : "hook"}
              label={"word" in inline ? "Word" : "Hook title"}
              value={"word" in inline ? draft.edit.words[inline.word].text : draft.edit.hook}
              maxLength={"word" in inline ? 40 : 48}
              onChange={(value) => ("word" in inline ? setEdit((e) => ({ ...e, words: e.words.map((w, i) => (i === inline.word ? { ...w, text: value } : w)) }), `inline-${inline.word}`) : setEdit((e) => ({ ...e, hook: value }), "hook"))}
              onDone={() => closeInline()}
              onCancel={() => closeInline(true)}
            >
              {"word" in inline && <WordPanel word={inline.word} edit={draft.edit} keyName={keyName} emojisOn={draft.options.emojis && !behind} zoomsOn={draft.options.zooms} sfxOn={draft.options.sfx} actions={wordActions} dark />}
            </InlineEditor>
          )}
          <div className="mx-auto mt-3 flex w-full max-w-[300px] items-center gap-3 lg:max-w-[340px]">
            <Button variant="tertiary" size="sm" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause /> : <Play />}
            </Button>
            <input type="range" min={0} max={draft.edit.duration} step={0.01} value={time} onChange={(e) => seek(Number(e.target.value))} className="h-1 min-w-0 flex-1 accent-[var(--ds-gray-1000)]" aria-label="Position in the reel" />
            <span className="shrink-0 text-xs tabular-nums text-gray-900">
              {clock(time)} / {clock(draft.edit.duration)}
            </span>
          </div>
          {behind && <p className="mx-auto mt-2 max-w-[340px] text-center text-xs text-gray-900">In the video, the big words go behind you.</p>}
        </div>

        {/* What to change. */}
        <div className="min-w-0">
          <div className="mb-4 flex h-10 items-center gap-0.5 overflow-x-auto rounded-md border border-gray-alpha-400 bg-background-100 p-1" role="tablist" aria-label="Edit">
            {TABS.map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("h-full flex-1 shrink-0 rounded px-2 text-[13px] transition-colors sm:px-3 sm:text-sm", tab === t ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000")}>
                {t}
              </button>
            ))}
          </div>

          {tab === "Style" && (
            <div className="space-y-5">
              <StylePicker value={draft.options.style} onChange={(style) => setOptions({ style })} changes={draft.options.look} />
              {behind && (
                <div>
                  <p className="mb-2 text-[13px] text-gray-900">Big words font</p>
                  <FontPicker value={draft.options.fonts} onChange={(fonts) => setOptions({ fonts })} />
                </div>
              )}
              <LookEditor style={draft.options.style} changes={draft.options.look} onChange={(change) => update((d) => ({ ...d, options: { ...d.options, look: change(d.options.look) } }), "look")} fonts={draft.options.fonts} showPreview={false} />
            </div>
          )}

          {tab === "Text" && (
            <TranscriptEditor
              edit={draft.edit}
              lines={lines}
              time={time}
              style={draft.options.style}
              selected={selected}
              hookOn={draft.options.hook}
              onHookOn={(hook) => setOptions({ hook })}
              onHookText={(text) => {
                seek(0.5);
                setEdit((x) => ({ ...x, hook: text }), "hook");
              }}
              emojisOn={draft.options.emojis}
              zoomsOn={draft.options.zooms}
              sfxOn={draft.options.sfx}
              actions={wordActions}
            />
          )}

          {tab === "Emojis" && <EmojiPanel edit={draft.edit} lines={lines} time={time} on={draft.options.emojis} behind={behind} actions={emojiActions} />}

          {tab === "Effects" && (
            <div className="space-y-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-alpha-400 p-3 text-sm">
                <input type="checkbox" checked={draft.options.zooms} onChange={(e) => setOptions({ zooms: e.target.checked })} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
                <span>
                  <span className="block font-medium text-gray-1000">Punch-in zooms</span>
                  <span className="mt-0.5 block text-xs text-gray-900">{draft.edit.zooms.length} in this reel. Add, remove or change their strength on any word in the Text tab.</span>
                </span>
              </label>
              <EffectsPanel effects={draft.edit.effects} cuts={draft.edit.cuts} time={time} actions={effectActions} />
            </div>
          )}

          {tab === "Filters" && <FiltersPanel picture={draft.edit.picture} onChange={setPicture} />}

          {tab === "Audio" && <AudioPanel sounds={draft.edit.sounds} hookSound={draft.edit.hookSound} hookOn={hookShown} on={draft.options.sfx} time={time} actions={soundActions} />}
        </div>
      </div>

      <div className="mt-6">
        <ReelTimeline edit={draft.edit} lines={lines} windows={windows} time={time} duration={draft.edit.duration} showEmojis={draft.options.emojis && !behind} showZooms={draft.options.zooms} showSounds={draft.options.sfx} onSeek={seek} onPick={pick} />
      </div>
    </div>
  );
}

/** The edit bar under the video: the text, live as it's typed; Enter or Done keeps it, Escape puts it back. */
function InlineEditor({ label, value, maxLength, onChange, onDone, onCancel, children }: { label: string; value: string; maxLength: number; onChange: (value: string) => void; onDone: () => void; onCancel: () => void; children?: React.ReactNode }) {
  return (
    <div className="mx-auto mt-2 w-full max-w-[300px] space-y-2.5 rounded-lg border border-white/10 bg-[#111214] p-2.5 text-white lg:max-w-[340px]">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          maxLength={maxLength}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onDone();
            if (e.key === "Escape") onCancel();
          }}
          className="h-9 min-w-0 flex-1 rounded-md bg-white/10 px-2.5 text-sm text-white outline-none ring-1 ring-white/25 placeholder:text-white/50 focus:ring-white/70"
        />
        <button type="button" onClick={onDone} className="h-9 shrink-0 rounded-md bg-white px-3 text-sm font-medium text-black">
          Done
        </button>
      </div>
      {children}
    </div>
  );
}
