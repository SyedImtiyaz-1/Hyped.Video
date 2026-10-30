"use client";
import { ArrowLeft, AudioLines, Captions, Check, FileText, Film, LoaderCircle, Palette, Pause, Play, Redo2, Scissors, Smile, Sparkles, Undo2, Wand2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { captionLines, cueOf, lineOfWord, resolveLook, type ReelLookChanges, type ReelStyle } from "@launchreel/core/captions";
import { EFFECTS, effectsAt, type PlacedEffect } from "@launchreel/core/effects";
import type { ReelPicture } from "@launchreel/core/picture";
import type { EmojiStyle, ReelEdit, ReelExport, ReelFont, ZoomStrength } from "@launchreel/core/reel";
import type { ReelSound } from "@launchreel/core/sounds";
import { punchAt, soundCues, zoomAim, zoomWindows } from "@launchreel/core/timeline";
import { cutClock, onCutTimeline, parseTrims, pauseTrims, trimAt, trimmedWords, wordsTrim, type Trim } from "@launchreel/core/trims";
import { MUSIC_DEFAULT_VOLUME } from "@launchreel/core/music-beds";
import { applyChatOps, type ChatOp } from "@launchreel/core/reel-chat";
import { BROLL_LENGTH, brollAt, longestShot, parseBroll, type BrollShot } from "@launchreel/core/broll";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { AudioPanel, type SoundActions } from "./audio-panel";
import { BrollLayer } from "./broll-layer";
import { BrollPanel, type BrollActions, type BrollRow } from "./broll-panel";
import { ChatPanel, type ChatMessage } from "./chat-panel";
import { CutsPanel, type TrimActions } from "./cuts-panel";
import { EffectsPanel, type EffectActions } from "./effects-panel";
import { EmojiPanel, type EmojiActions } from "./emoji-panel";
import { ExportDialog } from "./export-dialog";
import { FiltersPanel } from "./filters-panel";
import { FontPicker } from "./font-picker";
import { LiveCaptions, lineAt } from "./live-captions";
import { LookEditor } from "./look-editor";
import { PictureLayers, useVideoFilter, viewTransform } from "./picture-layers";
import { ReelTimeline, type TimelineDrag, type TimelineItem } from "./reel-timeline";
import { CuePlayer, MusicPlayer, preloadSounds } from "./sfx-player";
import { StylePicker } from "./style-picker";
import { soundOfWord, TranscriptEditor, WordPanel, type WordActions } from "./transcript-editor";

/** What the editor changes besides the edit itself: the style and its look, the big words' fonts, and the extras. */
export type EditorOptions = { style: ReelStyle; look: ReelLookChanges; fonts: ReelFont[]; emojis: boolean; zooms: boolean; sfx: boolean; hook: boolean };
type Draft = { options: EditorOptions; edit: ReelEdit };
type History = { past: Draft[]; present: Draft; future: Draft[]; group?: string; at?: number };

const TABS = ["Ask AI", "Style", "Text", "Cuts", "B-roll", "Emojis", "Effects", "Looks", "Audio"] as const;
type Tab = (typeof TABS)[number];
// The tools' icons on the wide screens' rail, where Ask AI has a column of its own.
const TAB_ICON: Record<Tab, LucideIcon> = { "Ask AI": Sparkles, Style: Captions, Text: FileText, Cuts: Scissors, "B-roll": Film, Emojis: Smile, Effects: Wand2, Looks: Palette, Audio: AudioLines };
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);
const ms = (t: number) => Math.round(t * 1000) / 1000;

/**
 * The reel editor: the reel's clean preview with everything drawn live as the render will make it (captions, emojis,
 * punch-ins, transitions and effects, the filter and overlays, and the sound effects), a timeline, and panels for every
 * change. Words can be edited right on the video. Export renders it again (free while the upload is kept).
 *
 * Two clocks: the edit, the panels and the timeline are on the recording's clock (`time`, the preview video's own),
 * where cut stretches still exist and can be put back; what's drawn on the preview is the edit on the cut video's clock
 * (onCutTimeline, as the render makes it), and the player plays straight over the cuts.
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
  askFirst,
  watermark = false,
  local = false,
  heard,
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
  /** A change asked for when the reel was made (a template's "Anything to change?"): the editor opens on Ask AI with it typed in. */
  askFirst?: string;
  /** A free-trial reel: it exports with the "Made with Hyped" mark (the export dialog says so). */
  watermark?: boolean;
  /**
   * A clip opened straight from this computer, not uploaded (the prompt box in demo mode): it plays and edits as any
   * reel does; what needs the server (Ask AI, B-roll search, Export) says so.
   */
  local?: boolean;
  /** A local clip's words, once they've been heard (they come after the editor opens): its captions. */
  heard?: ReelEdit["words"] | null;
}) {
  const router = useRouter();
  const [history, setHistory] = useState<History>({ past: [], present: { options, edit }, future: [] });
  const [exported, setExported] = useState<Draft>({ options, edit });
  const draft = history.present;
  const [tab, setTab] = useState<Tab>(askFirst ? "Ask AI" : "Style");
  // Until it's sent once: the chat panel starts again each time its tab opens.
  const [asked, setAsked] = useState(askFirst);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedTrim, setSelectedTrim] = useState<number | null>(null);
  const [selectedShot, setSelectedShot] = useState<number | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [exportState, setExportState] = useState<ReelExport | null>(initialExport);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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

  // A local clip's words land when they've been heard, as one step: its captions appear on the clip being edited.
  useEffect(() => {
    if (heard?.length) update((d) => ({ ...d, edit: { ...d.edit, words: heard } }));
  }, [heard, update]);

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

  // What the render will do, from the same code (packages/core): the edit on the cut video's clock, and its lines,
  // punch-ins and sounds. The lines and punch-ins go back on the recording's clock for the panels and the timeline.
  const trims = draft.edit.trims;
  const cutAt = useMemo(() => cutClock(draft.edit.duration, trims), [draft.edit.duration, trims]);
  const cutWords = useMemo(() => new Set(trimmedWords(draft.edit.words, trims)), [draft.edit.words, trims]);
  const view = useMemo(() => onCutTimeline(draft.edit), [draft.edit]);
  const look = useMemo(() => resolveLook(draft.options.style, draft.options.look), [draft.options.style, draft.options.look]);
  const viewLines = useMemo(() => captionLines(view.words, draft.options.style, look, view), [view, draft.options.style, look]);
  const viewWindows = useMemo(() => (draft.options.zooms ? zoomWindows(view, viewLines) : []), [view, viewLines, draft.options.zooms]);
  const lines = useMemo(
    () => (trims.length ? viewLines.map((l) => ({ ...l, start: cutAt.toUpload(l.start), end: cutAt.toUpload(l.end), words: l.words.map((w) => ({ ...w, start: cutAt.toUpload(w.start), end: cutAt.toUpload(w.end) })) })) : viewLines),
    [viewLines, cutAt, trims.length],
  );
  const windows = useMemo(() => (trims.length ? viewWindows.map((z) => ({ ...z, start: cutAt.toUpload(z.start), end: cutAt.toUpload(z.end) })) : viewWindows), [viewWindows, cutAt, trims.length]);
  // B-roll: each stored shot, when it plays on the cut clock (null when it doesn't: it overlaps the one before, or the
  // end), and how long it may get (to the next shot, the end, or its clip's end); on the recording's clock for the timeline.
  const brollRows = useMemo<BrollRow[]>(() => {
    const id = (s: BrollShot, at: number) => `${s.clip.source}:${s.clip.id}:${Math.round(at * 1000)}`;
    const shown = new Map(view.broll.map((v) => [id(v, v.at), v]));
    return draft.edit.broll.map((shot) => {
      const v = shown.get(id(shot, cutAt.toCut(shot.at))) ?? null;
      if (!v) return { shot, at: null, length: shot.length, most: shot.length };
      const next = view.broll.find((x) => x.at > v.at);
      return { shot, at: v.at, length: v.length, most: Math.floor(Math.min(longestShot(shot.clip), (next?.at ?? view.duration) - v.at) * 10) / 10 };
    });
  }, [draft.edit.broll, view, cutAt]);
  const brollSpans = useMemo(() => brollRows.flatMap((r, index) => (r.at === null ? [] : [{ index, start: cutAt.toUpload(r.at), end: cutAt.toUpload(r.at + r.length), query: r.shot.query }])), [brollRows, cutAt]);
  const hookShown = draft.options.hook && Boolean(draft.edit.hook);
  const cues = useMemo(() => (draft.options.sfx ? soundCues(view, hookShown) : []), [view, draft.options.sfx, hookShown]);
  const sounds = useRef(new CuePlayer());
  sounds.current.cues = cues;
  useEffect(() => preloadSounds(cues), [cues]);
  // The music bed, on the cut clock, dipping while a word is being said (with a moment after it, as the render's release).
  const music = useRef(new MusicPlayer());
  const speech = useMemo(() => view.words.filter((_, i) => !view.hidden.includes(i)).map((w) => [w.start - 0.05, w.end + 0.3] as const), [view]);
  music.current.music = view.audio.music;
  music.current.speaking = (t) => {
    let lo = 0;
    let hi = speech.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (speech[mid][1] < t) lo = mid + 1;
      else if (speech[mid][0] > t) hi = mid - 1;
      else return true;
    }
    return false;
  };

  // The player: the time comes from the video every frame while it plays, jumping over cut stretches; sound effects
  // follow it on the cut clock.
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const clocks = useRef({ trims, cutAt, duration: draft.edit.duration });
  clocks.current = { trims, cutAt, duration: draft.edit.duration };
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let drawn = 0;
    const tick = (now: number) => {
      const v = video.current;
      if (v) {
        const { trims: cut, cutAt: at, duration } = clocks.current;
        const k = trimAt(cut, v.currentTime);
        if (k >= 0 && !v.paused) v.currentTime = Math.min(duration, cut[k].end + 0.002);
        // The editor redraws about 25 times a second while it plays (captions and effects need no more), so a big clip
        // on a slow computer still plays smoothly; skipping the cuts and the sounds keep to every frame.
        if (now - drawn >= 40) {
          drawn = now;
          setTime(v.currentTime);
        }
        sounds.current.tick(at.toCut(v.currentTime), !v.paused);
        music.current.tick(at.toCut(v.currentTime), !v.paused);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      sounds.current.reset();
      music.current.reset();
    };
  }, [playing]);
  const seek = (t: number) => {
    const clamped = Math.max(0, Math.min(draft.edit.duration, t));
    if (video.current) video.current.currentTime = clamped;
    sounds.current.reset();
    music.current.reset();
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
  const viewTime = cutAt.toCut(time);
  const fx = effectsAt(view.effects, viewTime);
  const zoom = 1 + (draft.options.zooms ? punchAt(viewWindows, viewTime) : 0) + fx.zoom;
  const inTrim = trimAt(trims, time);
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
    // A cut next to a word that's already cut joins that cut, so no sliver of sound is left between them.
    cutWords: (words) =>
      setTrims((t, e) => [
        ...t,
        ...runs(words).map(([a, b]) => {
          const trim = wordsTrim(e.words, a, b);
          const near = (i: number) => (i >= 0 && i < e.words.length ? trimAt(t, (e.words[i].start + e.words[i].end) / 2) : -1);
          const [before, after] = [near(a - 1), near(b + 1)];
          return { ...trim, start: before >= 0 ? t[before].end : trim.start, end: after >= 0 ? t[after].start : trim.end };
        }),
      ]),
    restoreWord: (word) =>
      setTrims((t, e) => {
        const w = e.words[word];
        const k = trimAt(t, (w.start + w.end) / 2);
        return k < 0 ? t : t.filter((_, i) => i !== k);
      }),
  };

  // Cuts: every change goes through parseTrims, which keeps them in order, merged, on whole frames.
  const setTrims = (change: (trims: Trim[], e: ReelEdit) => Trim[]) => setEdit((e) => ({ ...e, trims: parseTrims(change(e.trims, e), e.duration) }));
  const trimActions: TrimActions = {
    restore: (index) => setTrims((t) => t.filter((_, i) => i !== index)),
    restoreAll: (reason) => setTrims((t) => (reason ? t.filter((x) => x.reason !== reason) : [])),
    cutPauses: () => setTrims((t, e) => [...t, ...pauseTrims(e.words, e.duration)]),
    select: (index) => {
      setSelectedTrim(index);
      video.current?.pause();
      seek(Math.min(draft.edit.duration, trims[index].start + 0.05));
    },
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
    setClean: (clean) => setEdit((e) => ({ ...e, audio: { ...e.audio, clean } })),
    setMusic: (track) => setEdit((e) => ({ ...e, audio: { ...e.audio, music: track ? { track, volume: e.audio.music?.volume ?? MUSIC_DEFAULT_VOLUME } : null } })),
    setMusicVolume: (volume) => setEdit((e) => ({ ...e, audio: { ...e.audio, music: e.audio.music ? { ...e.audio.music, volume: Math.round(volume * 100) / 100 } : null } }), "music-volume"),
  };
  const emojiActions: EmojiActions = {
    set: wordActions.setEmoji,
    setStyle: (patch: Partial<EmojiStyle>) => setEdit((e) => ({ ...e, emojiStyle: { ...e.emojiStyle, ...patch } })),
    setOn: (emojis) => setOptions({ emojis }),
    seek,
  };
  const setPicture = (patch: Partial<ReelPicture>, group?: string) => setEdit((e) => ({ ...e, picture: { ...e.picture, ...patch } }), group);
  // B-roll: every change goes through parseBroll, which keeps the shots in order, apart and inside their clips.
  const setBroll = (change: (shots: BrollShot[]) => BrollShot[], group?: string) => setEdit((e) => ({ ...e, broll: parseBroll(change(e.broll), e.duration) }), group);
  const shotHere = brollRows.findIndex((r) => r.at !== null && viewTime >= r.at && viewTime < r.at + r.length);
  const brollActions: BrollActions = {
    add: (clip, query) => {
      const next = view.broll.find((s) => s.at > viewTime);
      const room = Math.min((next?.at ?? view.duration) - viewTime, longestShot(clip));
      if (brollAt(view.broll, viewTime) >= 0) return "A shot already plays here. Swap it instead.";
      if (room < BROLL_LENGTH.min) return next ? "There's no room before the next shot. Move the playhead, or shorten that shot." : "There's no room before the end of the reel.";
      setBroll((shots) => [...shots, { at: ms(time), length: Math.floor(Math.min(BROLL_LENGTH.default, room) * 100) / 100, query, clip }]);
      return null;
    },
    swap: (index, clip, query) => setBroll((shots) => shots.map((s, i) => (i === index ? { ...s, clip, query: query || s.query, length: Math.min(s.length, longestShot(clip)) } : s))),
    setLength: (index, length) => setBroll((shots) => shots.map((s, i) => (i === index ? { ...s, length: Math.round(length * 100) / 100 } : s)), `broll-length-${index}`),
    remove: (index) => {
      setSelectedShot(null);
      setBroll((shots) => shots.filter((_, i) => i !== index));
    },
    removeAll: () => {
      setSelectedShot(null);
      setBroll(() => []);
    },
    select: (index) => {
      const row = brollRows[index];
      setSelectedShot(index);
      video.current?.pause();
      seek(row?.at != null ? cutAt.toUpload(row.at + 0.05) : (row?.shot.at ?? 0));
    },
  };

  // Editing on the timeline: a piece dragged (moved, or resized by an edge), a stretch of the video cut out, the picked
  // piece removed. A drag works from the edit as it was when the drag began, so the pieces' order can't shift under it,
  // and it's one undo step. Moved pieces snap to the playhead.
  const [timelinePick, setTimelinePick] = useState<TimelineItem | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const dragBase = useRef<ReelEdit | null>(null);
  const near = (t: number) => ms(Math.max(0, Math.min(draft.edit.duration, Math.abs(t - time) < 0.12 ? time : t)));
  const dragPiece = ({ item, mode, delta }: TimelineDrag) => {
    const base = (dragBase.current ??= draft.edit);
    const group = `timeline-${JSON.stringify(item)}`;
    if (item.kind === "broll") {
      const shots = base.broll.map((s, i) =>
        i !== item.index
          ? s
          : mode === "move"
            ? { ...s, at: near(s.at + delta) }
            : mode === "end"
              ? { ...s, length: ms(Math.max(BROLL_LENGTH.min, s.length + delta)) }
              : { ...s, at: near(s.at + delta), length: ms(Math.max(BROLL_LENGTH.min, s.length - delta)) },
      );
      setEdit(() => ({ ...base, broll: parseBroll(shots, base.duration) }), group);
    } else if (item.kind === "effect") {
      const old = base.effects[item.index];
      const spec = EFFECTS[old.effect];
      const next = mode === "end" ? { ...old, length: ms(Math.max(spec.min, Math.min(spec.max, old.length + delta))) } : { ...old, at: near(old.at + delta) };
      // Its sound goes along, as when it's moved in the Effects tab.
      const paired = pairedSound(base, old);
      setEdit(() => ({ ...base, effects: base.effects.map((x, k) => (k === item.index ? next : x)).sort((a, b) => a.at - b.at), sounds: base.sounds.map((s, k) => (k === paired ? { ...s, at: next.at } : s)).sort((a, b) => a.at - b.at) }), group);
    } else if (item.kind === "sound") {
      setEdit(() => ({ ...base, sounds: base.sounds.map((s, k) => (k === item.index ? { ...s, at: near(s.at + delta) } : s)).sort((a, b) => a.at - b.at) }), group);
    } else if (item.kind === "trim") {
      const t = base.trims[item.index];
      const shift = near(t.start + delta) - t.start;
      const moved = mode === "move" ? { ...t, start: t.start + shift, end: t.end + shift } : mode === "start" ? { ...t, start: near(Math.min(t.end - 0.05, t.start + delta)) } : { ...t, end: near(Math.max(t.start + 0.05, t.end + delta)) };
      setEdit(() => ({ ...base, trims: parseTrims(base.trims.map((x, k) => (k === item.index ? moved : x)), base.duration) }), group);
    }
  };
  const endDrag = () => {
    dragBase.current = null;
    // Its place among the pieces may have changed.
    setTimelinePick(null);
  };
  const cutRange = () => {
    if (range && range[1] - range[0] >= 0.1) setTrims((t) => [...t, { start: ms(range[0]), end: ms(range[1]), reason: "cut" }]);
    setRange(null);
  };
  const removePicked = () => {
    const p = timelinePick;
    if (p?.kind === "broll") brollActions.remove(p.index);
    else if (p?.kind === "effect") effectActions.remove(p.index);
    else if (p?.kind === "sound") soundActions.remove(p.index);
    else if (p?.kind === "trim") trimActions.restore(p.index);
    else return;
    setTimelinePick(null);
  };

  // The keys, as a video editor's: Space plays, the arrows step (Shift: a second), Delete removes what's picked on the
  // timeline or cuts the stretch selected on it, Escape lets go. Not while typing, on a focused control, or in a dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("dialog[open]")) return;
      if (e.key === " " && !target.closest("button, a, [role=button]")) {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        seek(Math.max(0, Math.min(draft.edit.duration, time + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 0.1))));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (range) cutRange();
        else if (timelinePick) removePicked();
        else return;
        e.preventDefault();
      } else if (e.key === "Escape") {
        setRange(null);
        setTimelinePick(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
    const t = cutAt.toUpload(Math.max(0, Math.min(view.duration, startAt)));
    const at = lineAt(lines, t) ?? lineAt(lines, t + 0.3);
    seek(at ? Math.max(t, at.line.start + 0.05) : t);
    if (at) editWord(at.line.words[0].i);
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A piece picked on the timeline: go there and open what edits it.
  const pick = (item: TimelineItem) => {
    setTimelinePick(item);
    setRange(null);
    if (item.kind === "trim") {
      setTab("Cuts");
      trimActions.select(item.index);
    } else if (item.kind === "broll") {
      setTab("B-roll");
      brollActions.select(item.index);
    } else if (item.kind === "line" || item.kind === "zoom" || item.kind === "emoji") {
      wordActions.select(item.word);
      setTab(item.kind === "emoji" ? "Emojis" : "Text");
    } else if (item.kind === "effect") {
      seek(Math.max(0, draft.edit.effects[item.index].at - 0.6));
      setTab("Effects");
    } else if (item.kind === "music") {
      setTab("Audio");
    } else {
      seek(Math.max(0, draft.edit.sounds[item.index].at - 0.6));
      setTab("Audio");
    }
  };

  // Chat edits: the message and the draft to the assistant; its checked changes come back and land as one undo step.
  const ask = async (message: string) => {
    setAsking(true);
    setChat((c) => [...c, { from: "you", text: message }]);
    const res = await fetch(`/api/reels/${jobId}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, time, draft: history.present }) }).catch(() => null);
    const body = res ? ((await res.json().catch(() => ({}))) as { reply?: string; ops?: ChatOp[]; error?: string }) : { error: "You're offline. Try again in a moment." };
    setAsking(false);
    if (!res?.ok || !body.ops) return setChat((c) => [...c, { from: "ai", text: body.error ?? "That didn't work. Try again in a moment.", failed: true }]);
    if (body.ops.length) update((d) => applyChatOps(d, body.ops!) as Draft);
    setChat((c) => [...c, { from: "ai", text: body.reply ?? "Done.", changes: body.ops!.length }]);
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

  // On wide screens Ask AI has its own column, so the tools' panel shows Style while Ask AI is the chosen tab.
  const panelTab: Tab = tab === "Ask AI" ? "Style" : tab;
  // The reel keeps its clip's shape: tall clips get the narrow preview, wide and square ones a wider one.
  const portrait = draft.edit.height >= draft.edit.width * 1.15;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6">
      {/* The bar: back, name, undo and redo, export. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ButtonLink href={local ? "/dashboard" : `/dashboard/videos/${jobId}`} variant="tertiary" size="sm" aria-label={local ? "Back to the dashboard" : "Back to the reel"}>
          <ArrowLeft />
        </ButtonLink>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium text-gray-1000">Edit reel</h1>
          <p className="truncate text-xs text-gray-900">
            {name} · {local ? "on this computer, not uploaded" : `free exports until ${until}`}
          </p>
        </div>
        <Button variant="tertiary" size="sm" onClick={undo} disabled={!history.past.length} aria-label="Undo">
          <Undo2 />
        </Button>
        <Button variant="tertiary" size="sm" onClick={redo} disabled={!history.future.length} aria-label="Redo">
          <Redo2 />
        </Button>
        <Button variant="primary" onClick={() => setExportOpen(true)} disabled={local || busy || rendering || (!dirty && exportState?.status !== "failed")} title={local ? "Exporting needs the clip uploaded, which demo mode can't do" : undefined}>
          {busy || rendering ? <LoaderCircle className="animate-spin" /> : <Check />}
          {rendering ? "Exporting…" : "Export"}
        </Button>
      </div>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} onExport={() => void exportVideo()} watermark={watermark} until={until} />
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

      {/* Wide screens, as Cardboard's editor: the tools' rail and panel, the preview in the middle, Ask AI always open on
          the right, the timeline below. Phones: the preview, then the tools as tabs, Ask AI among them. */}
      <div className="grid gap-4 lg:h-[calc(100dvh-15rem)] lg:min-h-[560px] lg:grid-cols-[44px_minmax(0,300px)_minmax(0,1fr)_minmax(0,340px)] lg:gap-5">
        {/* The preview: the clean video with everything the render adds, drawn live, in the reel's own shape (the render
            keeps the clip's), as large as the column allows. */}
        <div className="lg:col-start-3 lg:row-start-1 lg:flex lg:flex-col lg:items-center lg:justify-center lg:overflow-y-auto">
          <div
            ref={frameRef}
            className={cn(
              "relative mx-auto w-full overflow-hidden rounded-xl bg-black",
              portrait ? "max-w-[240px] sm:max-w-[300px] lg:max-w-[min(340px,calc((100dvh-22rem)*0.5625))]" : "max-w-[640px] lg:max-w-[min(720px,calc((100dvh-22rem)*var(--shape)))]",
            )}
            style={{ aspectRatio: `${draft.edit.width} / ${draft.edit.height}`, "--shape": draft.edit.width / draft.edit.height } as React.CSSProperties}
          >
            {svg}
            <video
              ref={video}
              src={previewUrl}
              playsInline
              preload="auto"
              className="absolute inset-0 size-full object-cover"
              style={{ ...viewTransform(zoom, fx.dx, fx.dy, zoomAim(draft.edit.width, draft.edit.height)), filter }}
              onClick={toggle}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onSeeked={(e) => setTime(e.currentTarget.currentTime)}
              onTimeUpdate={(e) => !playing && setTime(e.currentTarget.currentTime)}
            />
            <BrollLayer shots={view.broll} time={viewTime} playing={playing} filter={filter} />
            <PictureLayers picture={draft.edit.picture} fx={fx} animate={playing} />
            <LiveCaptions
              look={look}
              options={draft.options}
              edit={view}
              lines={viewLines}
              time={viewTime}
              onWord={editWord}
              onHook={editHook}
              onMove={(offset, done) => update((d) => ({ ...d, options: { ...d.options, look: { ...d.options.look, offset: offset || undefined } } }), done ? "move-done" : "move")}
              selected={inline && "word" in inline ? inline.word : null}
            />
            {/* Paused on a stretch that's cut: it isn't in the video, and it can be put back. */}
            {!playing && inTrim >= 0 && (
              <div className="absolute inset-x-3 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between gap-2 rounded-lg bg-black/75 px-3 py-2 text-[13px] text-white backdrop-blur-sm">
                <span>Cut from the video</span>
                <button type="button" onClick={() => trimActions.restore(inTrim)} className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black">
                  Put back
                </button>
              </div>
            )}
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
              {"word" in inline && <WordPanel word={inline.word} edit={draft.edit} keyName={keyName} emojisOn={draft.options.emojis && !behind} zoomsOn={draft.options.zooms} sfxOn={draft.options.sfx} cut={cutWords.has(inline.word)} actions={wordActions} dark />}
            </InlineEditor>
          )}
          <div className={cn("mx-auto mt-3 flex w-full items-center gap-3", portrait ? "max-w-[300px] lg:max-w-[340px]" : "max-w-[640px]")}>
            <Button variant="tertiary" size="sm" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause /> : <Play />}
            </Button>
            <input type="range" min={0} max={view.duration} step={0.01} value={viewTime} onChange={(e) => seek(cutAt.toUpload(Number(e.target.value)))} className="h-1 min-w-0 flex-1 accent-[var(--ds-gray-1000)]" aria-label="Position in the reel" />
            <span className="shrink-0 text-xs tabular-nums text-gray-900" title={trims.length ? `Cut from ${clock(draft.edit.duration)} recorded` : undefined}>
              {clock(viewTime)} / {clock(view.duration)}
            </span>
          </div>
          {behind && <p className="mx-auto mt-2 max-w-[340px] text-center text-xs text-gray-900">In the video, the big words go behind you.</p>}
        </div>

        {/* The tools: a rail of icons on wide screens, tabs on phones. */}
        <div className="hidden lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-1" role="tablist" aria-label="Tools" aria-orientation="vertical">
          {TABS.filter((t) => t !== "Ask AI").map((t) => {
            const Icon = TAB_ICON[t];
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={panelTab === t}
                aria-label={t}
                title={t}
                onClick={() => setTab(t)}
                className={cn("flex size-11 items-center justify-center rounded-lg transition-colors", panelTab === t ? "bg-gray-alpha-200 text-gray-1000" : "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000")}
              >
                <Icon className="size-[18px]" />
              </button>
            );
          })}
        </div>
        <div className="flex h-10 items-center gap-0.5 overflow-x-auto rounded-md border border-gray-alpha-400 bg-background-100 p-1 lg:hidden" role="tablist" aria-label="Edit">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("h-full flex-1 shrink-0 whitespace-nowrap rounded px-2 text-[13px] transition-colors sm:px-3 sm:text-sm", tab === t ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000")}>
              {t}
            </button>
          ))}
        </div>

        {/* What to change: the chosen tool. */}
        <div className={cn("min-w-0 lg:col-start-2 lg:row-start-1 lg:overflow-y-auto lg:pr-1", tab === "Ask AI" && "hidden lg:block")}>
          <p className="mb-3 hidden text-sm font-medium text-gray-1000 lg:block">{panelTab}</p>

          {panelTab === "Style" && (
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

          {panelTab === "Text" && (
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
              cut={cutWords}
              actions={wordActions}
            />
          )}

          {panelTab === "Cuts" && <CutsPanel edit={draft.edit} cutLength={view.duration} time={time} selected={selectedTrim} actions={trimActions} />}

          {panelTab === "B-roll" && local && <ServerOnly what="Stock B-roll search" />}

          {panelTab === "B-roll" && !local && <BrollPanel jobId={jobId} rows={brollRows} portrait={draft.edit.height > draft.edit.width} time={viewTime} current={shotHere} selected={selectedShot} actions={brollActions} />}

          {panelTab === "Emojis" && <EmojiPanel edit={draft.edit} lines={lines} time={time} on={draft.options.emojis} behind={behind} actions={emojiActions} />}

          {panelTab === "Effects" && (
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

          {panelTab === "Looks" && <FiltersPanel picture={draft.edit.picture} onChange={setPicture} />}

          {panelTab === "Audio" && <AudioPanel sounds={draft.edit.sounds} hookSound={draft.edit.hookSound} hookOn={hookShown} on={draft.options.sfx} time={time} audio={draft.edit.audio} actions={soundActions} />}
        </div>

        {/* Ask AI: always open beside the preview on wide screens; a tab on phones. */}
        <div className={cn("min-w-0 lg:col-start-4 lg:row-start-1 lg:flex lg:flex-col", tab !== "Ask AI" && "hidden")}>
          <p className="mb-3 hidden items-center gap-1.5 text-sm font-medium text-gray-1000 lg:flex">
            <Sparkles className="size-3.5 text-brand" /> Ask AI
          </p>
          <div className="min-h-0 lg:flex-1">
            {local ? <ServerOnly what="Ask AI" /> : <ChatPanel messages={chat} busy={asking} onSend={(m) => (setAsked(undefined), void ask(m))} onUndo={undo} draft={asked} fill />}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ReelTimeline
          edit={draft.edit}
          lines={lines}
          windows={windows}
          broll={brollSpans}
          time={time}
          duration={draft.edit.duration}
          showEmojis={draft.options.emojis && !behind}
          showZooms={draft.options.zooms}
          showSounds={draft.options.sfx}
          selected={timelinePick}
          range={range}
          onSeek={seek}
          onPick={pick}
          onDrag={dragPiece}
          onDragEnd={endDrag}
          onRange={(r) => (setRange(r), r && setTimelinePick(null))}
          onCutRange={cutRange}
        />
      </div>
    </div>
  );
}

/** Words as runs of neighbours: [first, last] each. */
function runs(words: number[]): [number, number][] {
  const sorted = [...new Set(words)].sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w === last[1] + 1) last[1] = w;
    else out.push([w, w]);
  }
  return out;
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

/** In a clip opened from this computer: what needs the clip uploaded, and why it isn't here. */
function ServerOnly({ what }: { what: string }) {
  return (
    <p className="rounded-lg border border-dashed border-gray-alpha-500 p-3 text-[13px] text-gray-900">
      <span className="font-medium text-gray-1000">{what}</span> works once your clip is uploaded and its first cut is made, with captions from what you say. Demo mode can&apos;t upload: try it on your account.
    </p>
  );
}
