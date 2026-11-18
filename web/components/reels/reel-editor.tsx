"use client";
import { ArrowLeft, ArrowLeftRight, AudioLines, Captions, Check, CircleAlert, FileText, Film, FolderOpen, History, Keyboard, LoaderCircle, Minimize, Palette, PanelLeft, PanelRight, Pause, Play, Plus, Scissors, Smile, Sparkles, Wand2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchingTemplate } from "@launchreel/core/caption-templates";
import { captionLines, cueOf, lineOfWord, REEL_STYLES, resolveLook, type ReelLookChanges, type ReelStyle } from "@launchreel/core/captions";
import { EFFECTS, effectsAt, type PlacedEffect } from "@launchreel/core/effects";
import type { ReelPicture } from "@launchreel/core/picture";
import type { EmojiStyle, ReelEdit, ReelExport, ReelFont, VideoSource, ZoomStrength } from "@launchreel/core/reel";
import { REEL_SOUNDS, type ReelSound } from "@launchreel/core/sounds";
import { punchAt, soundCues, zoomAim, zoomWindows } from "@launchreel/core/timeline";
import { cutClock, onCutTimeline, parseTrims, pauseTrims, trimAt, trimmedWords, wordsTrim, type Trim } from "@launchreel/core/trims";
import { libraryBed, MUSIC_DEFAULT_VOLUME, ORIGINAL_MUSIC } from "@launchreel/core/music-beds";
import { applyChatOps, CHAT_HISTORY, type ChatOp } from "@launchreel/core/reel-chat";
import { BROLL_LENGTH, brollAt, longestShot, parseBroll, type BrollShot } from "@launchreel/core/broll";
import { parseTransitions, type PlacedTransition, transitionDirs, transitionEffects, transitionJoints, type TransitionKind, transitionPlaces, TRANSITIONS, withTrims } from "@launchreel/core/transitions";
import { cn } from "@/lib/cn";
import { readPrefs, writePrefs } from "@/lib/prefs";
import { NEW_PROJECT } from "@/components/shell/nav";
import { ProjectTitle } from "@/components/shell/project-title";
import { Button, ButtonLink } from "@/components/ui/button";
import { AudioPanel, type SoundActions } from "./audio-panel";
import { BrollLayer } from "./broll-layer";
import { BrollPanel, type BrollActions, type BrollRow } from "./broll-panel";
import { CHAT_WORDS, chatLang } from "./chat-lang";
import { ChatPanel, quoted, type ChatMessage, type WorkStep } from "./chat-panel";
import { describeChanges, revertChanges } from "./chat-steps";
import { CutsPanel, type TrimActions } from "./cuts-panel";
import { EffectsPanel, type EffectActions } from "./effects-panel";
import { EmojiPanel, type EmojiActions } from "./emoji-panel";
import { ExportDialog } from "./export-dialog";
import { FiltersPanel } from "./filters-panel";
import { FontPicker } from "./font-picker";
import { LiveCaptions, lineAt } from "./live-captions";
import { LookEditor } from "./look-editor";
import { MediaPanel, shapeName } from "./media-panel";
import { PictureLayers, useVideoFilter, viewTransform } from "./picture-layers";
import { ReelTimeline, type TimelineDrag, type TimelineItem } from "./reel-timeline";
import { CuePlayer, MusicPlayer, preloadSounds, TrackPlayer } from "./sfx-player";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { StylePicker } from "./style-picker";
import { TemplateGallery } from "./template-gallery";
import { TransitionLayers } from "./transition-layers";
import { TransitionsPanel, type TransitionActions } from "./transitions-panel";
import { soundOfWord, TranscriptEditor, WordPanel, type WordActions } from "./transcript-editor";

/**
 * What the editor changes besides the edit itself: the style and its look, the big words' fonts, the extras, and (for
 * a product video, which can turn them off) whether there are captions at all.
 */
export type EditorOptions = { style: ReelStyle; look: ReelLookChanges; fonts: ReelFont[]; emojis: boolean; zooms: boolean; sfx: boolean; hook: boolean; captions?: boolean };
type Draft = { options: EditorOptions; edit: ReelEdit };
type History = { past: Draft[]; present: Draft; future: Draft[]; group?: string; at?: number };

const TABS = ["Ask AI", "Library", "Style", "Text", "Cuts", "Transitions", "B-roll", "Emojis", "Effects", "Looks", "Audio"] as const;
type Tab = (typeof TABS)[number];
// The tools' icons on the wide screens' rail, where Ask AI has a column of its own.
const TAB_ICON: Record<Tab, LucideIcon> = { "Ask AI": Sparkles, Library: FolderOpen, Style: Captions, Text: FileText, Cuts: Scissors, Transitions: ArrowLeftRight, "B-roll": Film, Emojis: Smile, Effects: Wand2, Looks: Palette, Audio: AudioLines };
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
// A chat's name, as Cardboard's header shows it: its first request.
const chatTitle = (chat: ChatMessage[]) => chat.find((m) => m.from === "you")?.text ?? "Ask AI";
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);
const ms = (t: number) => Math.round(t * 1000) / 1000;
// One frame at the render's 30 fps: what the arrow keys step.
const FRAME = 1 / 30;
// Wide screens: the four-column layout, where the side panels can be hidden ([ and ]).
const WIDE = "(min-width: 1024px)";

/** A short fingerprint of a draft (FNV-1a), to know a draft kept in this browser belongs to the edit it was made on. */
function fingerprint(d: Draft) {
  const s = JSON.stringify(d);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + s.length.toString(36);
}

/**
 * The reel editor: the reel's clean preview with everything drawn live as the render will make it (captions, emojis,
 * punch-ins, transitions and effects, the filter and overlays, and the sound effects), a timeline, and panels for every
 * change. Words can be edited right on the video. Export renders it again (free while the upload is kept).
 *
 * A product video (`video`) opens here too, in its own shape: its words are its narration's (none without one), its
 * captions can be turned off, there's no "Behind you" or pause cutting, and its own soundtrack plays unless the music
 * is changed (then its narration alone plays, from `voiceUrl`, under the new bed).
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
  video: product = null,
  voiceUrl,
  askFirst,
  chatBefore,
  startOnMedia = false,
  watermark = false,
  local = false,
  heard,
  notice,
}: {
  jobId: string;
  name: string;
  options: EditorOptions;
  edit: ReelEdit;
  previewUrl: string;
  initialExport: ReelExport | null;
  /** When free exports end (a reel's upload is kept REEL_EDIT_DAYS); null for a product video, which keeps its own. */
  editableUntil: string | null;
  video?: VideoSource | null;
  voiceUrl?: string;
  /** Opened from the reel's page at this second: the editor starts there, with that moment's caption open to edit. */
  startAt?: number;
  /** A change asked for when the reel was made (a template's "Anything to change?"): the editor opens on Ask AI with it typed in. */
  askFirst?: string;
  /** What was said to Ask AI before the clip was in (a new project's empty editor): Ask AI carries on from it. */
  chatBefore?: ChatMessage[];
  /** The tools' panel starts on Media, the clip in the library (a clip just brought in from this computer). */
  startOnMedia?: boolean;
  /** A free-trial reel: it exports with the "Made with Hyped" mark (the export dialog says so). */
  watermark?: boolean;
  /**
   * A clip opened straight from this computer, not uploaded (the prompt box in demo mode): it plays and edits as any
   * reel does; what needs the server (Ask AI, B-roll search, Export) says so.
   */
  local?: boolean;
  /** A local clip's words, once they've been heard (they come after the editor opens): its captions. */
  heard?: ReelEdit["words"] | null;
  /** Notes over the editor, under its bar (a local clip's: why it isn't uploaded, its captions on the way). */
  notice?: React.ReactNode;
}) {
  const router = useRouter();
  const [history, setHistory] = useState<History>({ past: [], present: { options, edit }, future: [] });
  const [exported, setExported] = useState<Draft>({ options, edit });
  const draft = history.present;
  const noun = product ? "video" : "reel";
  // A product video without a narration has no words: nothing to caption, cut or put emojis on.
  const wordless = draft.edit.words.length === 0;
  const tabs = TABS.filter((t) => !(wordless && (t === "Style" || t === "Text" || t === "Cuts" || t === "Emojis")));
  const [tab, setTab] = useState<Tab>(startOnMedia ? "Library" : askFirst || wordless ? "Ask AI" : "Style");
  // Until it's sent once: the chat panel starts again each time its tab opens.
  const [asked, setAsked] = useState(askFirst);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedTrim, setSelectedTrim] = useState<number | null>(null);
  const [selectedShot, setSelectedShot] = useState<number | null>(null);
  // The place picked in the Transitions tab (upload clock); the one nearest the playhead until one is.
  const [selectedPlace, setSelectedPlace] = useState<number | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>(chatBefore ?? []);
  // Earlier chats in this visit (newest first): a new chat keeps the one before here, to open again from the history.
  const [pastChats, setPastChats] = useState<ChatMessage[][]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const newChat = () => {
    if (chat.length) setPastChats((p) => [chat, ...p].slice(0, 20));
    setChat([]);
    setAsked(undefined);
  };
  const openChat = (i: number) => {
    const picked = pastChats[i];
    setPastChats((p) => [...(chat.length ? [chat] : []), ...p.filter((_, k) => k !== i)]);
    setChat(picked);
    setHistoryOpen(false);
  };
  const [asking, setAsking] = useState(false);
  // While Ask AI works: its steps as they happen.
  const [live, setLive] = useState<WorkStep[] | null>(null);
  const [exportState, setExportState] = useState<ReelExport | null>(initialExport);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Editing right on the video: a word (or the hook), and what it said before, for Escape.
  const [inline, setInline] = useState<{ word: number; original: string } | { hook: true; original: string } | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  // Wide screens: the tools' panel and Ask AI can be hidden, for a bigger preview.
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const askBox = useRef<HTMLTextAreaElement>(null);
  // Ask AI: an uploaded reel asks the render Worker (/api/reels/[id]/chat); a clip from this computer can ask too in
  // local development (/api/local/chat, with the root .env's key), never on the live site.
  const localAsk = local && process.env.NODE_ENV === "development";
  const canAsk = !local || localAsk;
  // Each Ask AI answer that changed something: the draft before and after it, so Undo this can take back that answer.
  const steps = useRef(new Map<number, { before: Draft; after: Draft }>());

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

  // The draft is kept in this browser as it changes, and comes back when the editor opens again on the same edit (the
  // last export's): edits survive a closed tab or a reload until they're exported. A clip from this computer isn't kept.
  const dirty = !same(draft, exported);
  const storeKey = `hyped:reel-draft:${jobId}`;
  const [saveState, setSaveState] = useState<"saved" | "saving" | "failed">("saved");
  const restored = useRef(false);
  useEffect(() => {
    if (local || restored.current) return;
    restored.current = true;
    try {
      const kept = JSON.parse(localStorage.getItem(storeKey) ?? "null") as { base?: string; draft?: Draft } | null;
      const start = { options, edit };
      if (kept?.draft?.edit?.words && kept.base === fingerprint(start) && !same(kept.draft, start)) setHistory({ past: [start], present: kept.draft, future: [] });
    } catch {}
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (local) return;
    if (!dirty) {
      try {
        localStorage.removeItem(storeKey);
      } catch {}
      setSaveState("saved");
      return;
    }
    setSaveState("saving");
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storeKey, JSON.stringify({ base: fingerprint(exported), draft }));
        setSaveState("saved");
      } catch {
        setSaveState("failed");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, exported, dirty, local, storeKey]);

  // Leaving with edits that aren't kept anywhere (not exported, and this browser couldn't save them) asks first.
  const unsaved = dirty && (local || saveState !== "saved");
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

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
  // Transitions: where they can go (upload clock), where each plays (cut clock), and the effects some bring along.
  const places = useMemo(() => transitionPlaces(draft.edit), [draft.edit]);
  const joints = useMemo(() => transitionJoints(draft.edit), [draft.edit]);
  const viewEffects = useMemo(() => (joints.length ? [...view.effects, ...transitionEffects(joints)].sort((a, b) => a.at - b.at) : view.effects), [view.effects, joints]);
  const hookShown = draft.options.hook && Boolean(draft.edit.hook);
  const cues = useMemo(() => (draft.options.sfx ? soundCues(view, hookShown) : []), [view, draft.options.sfx, hookShown]);
  const sounds = useRef(new CuePlayer());
  sounds.current.cues = cues;
  useEffect(() => preloadSounds(cues), [cues]);
  // The music bed, on the cut clock, dipping while a word is being said (with a moment after it, as the render's release).
  const music = useRef(new MusicPlayer());
  const speech = useMemo(() => view.words.filter((_, i) => !view.hidden.includes(i)).map((w) => [w.start - 0.05, w.end + 0.3] as const), [view]);
  music.current.music = libraryBed(view.audio.music);
  // A product video plays its own soundtrack in the preview; with the music changed, its narration alone instead.
  const ownSound = !product || view.audio.music?.track === ORIGINAL_MUSIC;
  const narration = useRef(new TrackPlayer());
  narration.current.url = !ownSound && product?.voice && voiceUrl ? voiceUrl : null;
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
        narration.current.tick(v.currentTime, !v.paused);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      sounds.current.reset();
      music.current.reset();
      narration.current.reset();
    };
  }, [playing]);
  const seek = (t: number) => {
    const clamped = Math.max(0, Math.min(draft.edit.duration, t));
    if (video.current) video.current.currentTime = clamped;
    sounds.current.reset();
    music.current.reset();
    narration.current.reset();
    setTime(clamped);
  };
  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  // Full screen (the button under the preview, or F): the preview's column, with its controls, takes the whole screen;
  // Escape or the button again leaves it.
  const stage = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);
  useEffect(() => {
    const change = () => setFull(Boolean(stage.current) && document.fullscreenElement === stage.current);
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void stage.current?.requestFullscreen?.().catch(() => {});
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
  // The frame's shape (a product video can be landscape or square): the preview, its column and its controls follow it.
  const aspect = { width: draft.edit.width, height: draft.edit.height };
  const shape = aspect.height > aspect.width * 1.15 ? "tall" : aspect.width > aspect.height * 1.15 ? "wide" : "square";
  const barWidth = { tall: "max-w-[300px] lg:max-w-[340px]", square: "max-w-[360px] lg:max-w-[440px]", wide: "max-w-[640px]" }[shape];
  const captionsShown = draft.options.captions !== false && !wordless;
  const fx = effectsAt(viewEffects, viewTime);
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

  // Cuts: every change goes through parseTrims, which keeps them in order, merged, on whole frames. A transition on a
  // jump cut follows it: to its new end when it grows past it (a word next to it cut too), or away, with its sound, when
  // the cut is put back (no cut there any more).
  const setTrims = (change: (trims: Trim[], e: ReelEdit) => Trim[]) => setEdit((e) => withTrims(e, parseTrims(change(e.trims, e), e.duration)));
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
  // Transitions come with their sound too (on the upload clock, at the place), and take it along when they go.
  const pairedTransitionSound = (sounds: ReelEdit["sounds"], t: PlacedTransition) => {
    const sound = TRANSITIONS[t.kind].sound;
    return sound ? sounds.findIndex((s) => Math.abs(s.at - t.at) < 0.001 && s.sound === sound) : -1;
  };
  /**
   * Transitions put at places (null takes one away): the old one's sound goes, and the new one's comes where it plays
   * (one sound a moment).
   */
  const putTransitions = (e: ReelEdit, puts: { at: number; kind: TransitionKind | null }[], withSound: boolean): ReelEdit => {
    const sounds = [...e.sounds];
    const fresh: ReelEdit["sounds"] = [];
    let transitions = [...e.transitions];
    for (const { at, kind } of puts) {
      const old = transitions.find((t) => Math.abs(t.at - at) < 0.001);
      if (old && old.kind === kind) continue;
      if (old) {
        const paired = pairedTransitionSound(sounds, old);
        if (paired >= 0) sounds.splice(paired, 1);
        transitions = transitions.filter((t) => t !== old);
      }
      if (!kind) continue;
      const spec = TRANSITIONS[kind];
      const dirs = transitionDirs(kind);
      const dir = old?.dir && dirs.includes(old.dir) ? old.dir : dirs[0];
      transitions.push({ at, kind, ...(dir ? { dir } : {}), length: spec.length });
      if (withSound && draft.options.sfx && spec.sound) fresh.push({ at, sound: spec.sound });
    }
    const next = parseTransitions(transitions, e.duration);
    const plays = transitionJoints({ ...e, transitions: next });
    for (const f of fresh) if (plays.some((j) => Math.abs(j.at - f.at) < 0.001) && !sounds.some((s) => Math.abs(s.at - f.at) < 0.15)) sounds.push(f);
    return { ...e, transitions: next, sounds: sounds.sort((a, b) => a.at - b.at) };
  };
  // A place's transition from a moment before it (cut clock), to play or pause on.
  const before = (at: number) => cutAt.toUpload(Math.max(0, cutAt.toCut(at) - (joints.find((j) => Math.abs(j.at - at) < 0.001)?.length ?? 0) / 2 - 0.6));
  const transitionActions: TransitionActions = {
    put: (at, kind, withSound) => {
      setSelectedPlace(at);
      setEdit((e) => putTransitions(e, [{ at, kind }], withSound));
      // Paused on the cut, the picture shows it half way.
      if (!playing) seek(at);
    },
    change: (at, patch) => setEdit((e) => ({ ...e, transitions: parseTransitions(e.transitions.map((t) => (Math.abs(t.at - at) < 0.001 ? { ...t, ...patch } : t)), e.duration) }), patch.length !== undefined ? `transition-length-${at}` : undefined),
    putAll: (kind, withSound) =>
      setEdit((e) => {
        const at = transitionPlaces(e);
        const gone = e.transitions.filter((t) => !at.some((p) => Math.abs(p - t.at) < 0.001)).map((t) => ({ at: t.at, kind: null }));
        return putTransitions(putTransitions(e, gone, false), at.map((p) => ({ at: p, kind })), withSound);
      }),
    removeAll: () => setEdit((e) => putTransitions(e, e.transitions.map((t) => ({ at: t.at, kind: null })), false)),
    select: (at) => {
      setSelectedPlace(at);
      video.current?.pause();
      seek(at);
    },
    play: (at) => {
      setSelectedPlace(at);
      seek(before(at));
      void video.current?.play();
    },
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
  // and it's one undo step. Moved pieces snap to the playhead, unless that's off in Settings → Preferences.
  const [timelinePick, setTimelinePick] = useState<TimelineItem | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);
  const dragBase = useRef<ReelEdit | null>(null);
  const [snap, setSnap] = useState(true);
  useEffect(() => setSnap(readPrefs().snap), []);
  const near = (t: number) => ms(Math.max(0, Math.min(draft.edit.duration, snap && Math.abs(t - time) < 0.12 ? time : t)));
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

  // The keys, as a video editor's (the ? key lists them: shortcuts-dialog.tsx): Space plays, the arrows step a frame
  // (Shift: a second), up and down go to the previous or next caption line, ⌘E exports, ⌘/ goes to Ask AI, [ and ]
  // hide the side panels, Delete removes what's picked on the timeline or cuts the stretch selected on it, Escape lets
  // go. Not while typing, on a focused control, or in a dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.altKey || target.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("dialog[open]")) return;
      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === "e") {
          e.preventDefault();
          if (canExport) setExportOpen(true);
        } else if (e.key === "/") {
          e.preventDefault();
          focusAsk();
        }
        return;
      }
      if (e.key === " " && !target.closest("button, a, [role=button]")) {
        e.preventDefault();
        toggle();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        seek(Math.max(0, Math.min(draft.edit.duration, time + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : FRAME))));
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const to = e.key === "ArrowUp" ? [...lines].reverse().find((l) => l.start < time - 0.05) : lines.find((l) => l.start > time + 0.05);
        if (to) seek(to.start + 0.01);
      } else if (e.key === "[" || e.key === "]") {
        if (e.key === "[") setLeftOpen((o) => !o);
        else setRightOpen((o) => !o);
      } else if (e.key === "?") {
        setKeysOpen(true);
      } else if (e.key === "f" || e.key === "F") {
        toggleFull();
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

  // A piece picked on the timeline: go there and open what edits it (the tools' panel too, if it was hidden).
  const pick = (item: TimelineItem) => {
    setTimelinePick(item);
    setRange(null);
    setLeftOpen(true);
    if (item.kind === "trim") {
      setTab("Cuts");
      trimActions.select(item.index);
    } else if (item.kind === "broll") {
      setTab("B-roll");
      brollActions.select(item.index);
    } else if (item.kind === "line" || item.kind === "zoom" || item.kind === "emoji") {
      wordActions.select(item.word);
      setTab(item.kind === "emoji" ? "Emojis" : "Text");
    } else if (item.kind === "transition") {
      setTab("Transitions");
      transitionActions.select(item.at);
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

  // What's picked in the editor, for Ask AI: a label over its box, and the same in the assistant's terms (word numbers,
  // seconds on the cut video's clock, as its context gives them).
  const quote = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);
  const cutSeconds = (t: number) => `${cutAt.toCut(t).toFixed(1)}s`;
  const wordText = (i: number) => draft.edit.words[i]?.text ?? "";
  const lineText = (word: number) => lines[lineOfWord(lines, word)]?.text ?? wordText(word);
  const selection = ((): { label: string; ai: string } | null => {
    const p = timelinePick;
    if (inline && "word" in inline) return { label: `Word: “${quote(wordText(inline.word))}”`, ai: `word ${inline.word} "${wordText(inline.word)}"` };
    if (inline) return { label: "Hook title", ai: "the hook title" };
    if (range) return { label: `${clock(cutAt.toCut(range[0]))}–${clock(cutAt.toCut(range[1]))}`, ai: `the stretch from ${cutSeconds(range[0])} to ${cutSeconds(range[1])}` };
    if (p?.kind === "line") return { label: `Line: “${quote(lineText(p.word))}”`, ai: `the caption line starting at word ${p.word} ("${lineText(p.word)}")` };
    if (p?.kind === "zoom") return { label: `Punch-in on “${quote(wordText(p.word))}”`, ai: `the punch-in on word ${p.word} "${wordText(p.word)}"` };
    if (p?.kind === "emoji") return { label: `Emoji on “${quote(wordText(p.word))}”`, ai: `the emoji on word ${p.word} "${wordText(p.word)}"` };
    if (p?.kind === "effect" && draft.edit.effects[p.index]) {
      const fx = draft.edit.effects[p.index];
      return { label: `Effect: ${EFFECTS[fx.effect].label}`, ai: `the ${fx.effect} effect at ${cutSeconds(fx.at)}` };
    }
    if (p?.kind === "sound" && draft.edit.sounds[p.index]) {
      const s = draft.edit.sounds[p.index];
      return { label: `Sound: ${REEL_SOUNDS[s.sound].label}`, ai: `the ${s.sound} sound at ${cutSeconds(s.at)}` };
    }
    if (p?.kind === "trim" && trims[p.index]) {
      const t = trims[p.index];
      return { label: `Cut at ${clock(cutAt.toCut(t.start))}`, ai: `the ${t.reason} cut at ${cutSeconds(t.start)} (${(t.end - t.start).toFixed(1)}s long)` };
    }
    if (p?.kind === "broll" && brollRows[p.index]) {
      const r = brollRows[p.index];
      return { label: `B-roll: ${quote(r.shot.query || "stock clip")}`, ai: `the B-roll shot "${r.shot.query || "stock clip"}"${r.at === null ? "" : ` at ${r.at.toFixed(1)}s`}` };
    }
    if (p?.kind === "music" && draft.edit.audio.music) return { label: "Music", ai: `the music (${draft.edit.audio.music.track} at ${draft.edit.audio.music.volume})` };
    if (tab === "Text" && selected !== null && draft.edit.words[selected]) return { label: `Word: “${quote(wordText(selected))}”`, ai: `word ${selected} "${wordText(selected)}"` };
    return null;
  })();

  // Chat edits: the message, the draft and what's picked to the assistant; its checked changes come back and land as
  // one undo step, on the draft as it is by then (edits made while it was thinking stay). Its message lists what it
  // changed, with Undo this.
  const latest = useRef(history);
  latest.current = history;
  const answered = useRef(0);
  const ask = async (message: string) => {
    // The chat so far goes with it (the latest messages; failed ones left out), so "it", "more" and "undo that" make sense.
    // Answers that changed something carry their number, so "undo that" or "wapas karo" can name one (undo_answer).
    const said = chat.filter((m) => !m.failed).map((m) => ({ from: m.from, text: m.text, ...(m.step !== undefined ? { answer: m.step, undone: !undoable.has(m.step) } : {}) }));
    setAsking(true);
    // Its steps and labels in the language they typed in (the reply comes from the model in kind).
    const lang = chatLang(message);
    const t = CHAT_WORDS[lang];
    setChat((c) => [...c, { from: "you", text: message, lang }]);
    // The answer's steps, under "Worked for": what was asked, what the assistant looked at, what it worked out.
    const started = Date.now();
    const words = history.present.edit.words.length;
    const looked = [t.at(clock(viewTime)), ...(selection ? [selection.label] : []), words ? t.captionWords(words) : t.noCaptions];
    const done: WorkStep[] = [
      { title: t.read, items: [quoted(message)] },
      { title: t.looked, items: looked },
    ];
    const work = (changes: string[]) => ({
      ms: Date.now() - started,
      steps: [...done, ...(changes.length ? [{ title: t.workedOut(changes.length), items: [t.checked] }, { title: t.made }] : [{ title: t.nothing }])],
    });
    // Live while it works, as Claude's and Cardboard's chats show it.
    setLive([...done, { title: t.working, status: "active" }, { title: t.making, status: "pending" }]);
    const res = await fetch(localAsk ? "/api/local/chat" : `/api/reels/${jobId}/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, time, draft: history.present, selection: selection?.ai, history: said.slice(-CHAT_HISTORY.turns) }) }).catch(() => null);
    const body = res ? ((await res.json().catch(() => ({}))) as { reply?: string; ops?: ChatOp[]; error?: string }) : { error: "You're offline. Try again in a moment." };
    setAsking(false);
    setLive(null);
    if (!res?.ok || !body.ops) return setChat((c) => [...c, { from: "ai", text: body.error ?? "That didn't work. Try again in a moment.", failed: true }]);
    const ops = body.ops;
    if (!ops.length) return setChat((c) => [...c, { from: "ai", text: body.reply ?? "Done.", work: work([]), lang }]);
    // Earlier answers it was asked to take back go first (as Undo this does), then its own changes.
    const make = (d: Draft) =>
      applyChatOps(
        ops.reduce((x, op) => {
          const s = op.op === "undo_answer" ? steps.current.get(op.answer) : undefined;
          return (s && revertChanges(x, s.before, s.after)) ?? x;
        }, d),
        ops.filter((op) => op.op !== "undo_answer"),
      ) as Draft;
    const before = latest.current.present;
    const after = make(before);
    update((d) => (d === before ? after : make(d)));
    const step = ++answered.current;
    steps.current.set(step, { before, after });
    const changes = describeChanges(before, after);
    setChat((c) => [...c, { from: "ai", text: body.reply ?? "Done.", changes, step, work: work(changes), lang }]);
  };
  // Undo this: the answer's parts put back, as a step of its own (so it can be redone); later edits elsewhere stay.
  const undoAnswer = (m: ChatMessage) => {
    const s = m.step === undefined ? undefined : steps.current.get(m.step);
    if (s) update((d) => revertChanges(d, s.before, s.after) ?? d);
  };
  const undoable = useMemo(() => {
    const out = new Set<number>();
    for (const m of chat) {
      const s = m.step === undefined ? undefined : steps.current.get(m.step);
      if (s && revertChanges(draft, s.before, s.after)) out.add(m.step!);
    }
    return out;
  }, [chat, draft]);
  // ⌘/: to Ask AI's box (on phones, its tab; on wide screens, its column, shown again if it was hidden).
  const focusAsk = () => {
    if (!canAsk) return;
    setRightOpen(true);
    if (!window.matchMedia(WIDE).matches) setTab("Ask AI");
    requestAnimationFrame(() => askBox.current?.focus());
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

  // Export (the button and ⌘E): something new to export, or a failed export to try again; never a clip that isn't uploaded.
  const canExport = !local && !busy && !rendering && (dirty || exportState?.status === "failed");
  const until = editableUntil ? new Date(editableUntil).toLocaleDateString("en", { day: "numeric", month: "short" }) : null;
  const keyName = behind ? "big word" : "highlight";

  // On wide screens Ask AI has its own column, so the tools' panel shows Style while Ask AI is the chosen tab.
  const panelTab: Tab = tab === "Ask AI" ? "Style" : tab;
  // The reel keeps its clip's shape: tall clips get the narrow preview, wide and square ones a wider one.
  const portrait = draft.edit.height >= draft.edit.width * 1.15;
  // Wide screens' columns: the rail, the tools' panel, the preview, Ask AI. A hidden tools' panel closes up (the rail
  // stays); a hidden Ask AI leaves a rail of its own, as the tools' (its button to show it again, where it was).
  const columns = `56px ${leftOpen ? "minmax(0,320px)" : "0px"} minmax(0,1fr) ${rightOpen ? "minmax(0,360px)" : "52px"}`;
  const openTool = (t: Tab) => {
    setTab(t);
    setLeftOpen(true);
  };

  return (
    // Wide screens: the editor fills the window and never scrolls as a page: the bar and the timeline keep their
    // height, the panels and the preview take the rest (only panels scroll inside).
    <div className="flex w-full flex-col px-4 py-4 sm:px-6 lg:h-dvh lg:min-h-[520px] lg:p-0">
      {/* The bar: back, name, where the edits are kept; a new project (named, as Cardboard's buttons are), the reel's
          shape, the keys, undo and redo, export. */}
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2 lg:mb-0 lg:h-12 lg:flex-nowrap lg:border-b lg:border-editor-line lg:px-3">
        <ButtonLink href={local ? "/dashboard" : `/dashboard/videos/${jobId}`} variant="tertiary" size="sm" aria-label={local ? "Back to the dashboard" : `Back to the ${noun}`} title={local ? "Back to the dashboard" : `Back to the ${noun}`}>
          <ArrowLeft />
        </ButtonLink>
        <div className="min-w-0 flex-1">
          <ProjectTitle jobId={local ? null : jobId} name={name} />
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-gray-900">
            <span className="truncate" title={local ? "Open from your computer, not uploaded: B-roll search and Export need the clip uploaded." : undefined}>
              {product ? "Product video" : "Reel"} ·{local ? "on this computer, not uploaded" : until ? `free exports until ${until}` : "free exports"}
            </span>
            {!local && (
              <span
                className={cn("flex shrink-0 items-center gap-1", saveState === "failed" && "text-red-900")}
                role="status"
                title={saveState === "failed" ? "This browser couldn't keep your edits (its storage is full or turned off). Export to keep them." : dirty ? "Kept in this browser until you export. Export puts them in the video." : "Everything is in the exported video."}
              >
                ·{saveState === "saving" ? <LoaderCircle className="size-3 animate-spin" /> : saveState === "failed" ? <CircleAlert className="size-3" /> : <Check className="size-3" />}
                {saveState === "saving" ? "Saving…" : saveState === "failed" ? "Unsaved changes" : "Saved"}
              </span>
            )}
          </p>
        </div>
        <ButtonLink href={NEW_PROJECT} variant="secondary" size="sm" title="Start a new project in an empty editor" aria-label="New project">
          <Plus />
          <span className="hidden sm:inline">New project</span>
        </ButtonLink>
        <span className="hidden rounded-md border border-gray-alpha-400 px-2 py-0.5 text-xs tabular-nums text-gray-900 sm:inline" title="The reel's shape (it keeps your clip's)">
          {shapeName(draft.edit.width, draft.edit.height)}
        </span>
        <Button variant="tertiary" size="sm" onClick={() => setKeysOpen(true)} aria-label="Keyboard shortcuts (?)" title="Keyboard shortcuts  ?" className="hidden sm:inline-flex">
          <Keyboard />
        </Button>
        {/* Undo and redo are in the timeline's header; Export is the light button with its key, as Cardboard's. */}
        <button
          type="button"
          onClick={() => setExportOpen(true)}
          disabled={!canExport}
          title={local ? "Exporting needs the clip uploaded" : "Export  ⌘E"}
          className="flex h-8 items-center gap-2 rounded-md bg-gray-1000 px-3 text-sm font-medium text-background-100 transition-colors hover:bg-gray-900 disabled:opacity-50 disabled:hover:bg-gray-1000"
        >
          {(busy || rendering) && <LoaderCircle className="size-4 animate-spin" />}
          {rendering ? "Exporting…" : "Export"}
          <kbd className="hidden font-sans text-xs opacity-60 sm:inline">⌘E</kbd>
        </button>
        {/* Ask AI's panel, shown or hidden, from the bar's corner as Cardboard's. */}
        <button type="button" onClick={() => setRightOpen((o) => !o)} aria-pressed={rightOpen} aria-label={rightOpen ? "Hide Ask AI (])" : "Show Ask AI (])"} title={rightOpen ? "Hide Ask AI  ]" : "Show Ask AI  ]"} className="hidden size-8 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000 lg:flex">
          <PanelRight className="size-4" />
        </button>
      </div>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} onExport={() => void exportVideo()} watermark={watermark} until={until} />
      <ShortcutsDialog open={keysOpen} onClose={() => setKeysOpen(false)} />
      {notice && <div className="mb-3 shrink-0 space-y-2 lg:mb-0 lg:border-b lg:border-editor-line lg:px-3 lg:py-2">{notice}</div>}
      {(error || exportState) && (
        <p className={cn("mb-4 rounded-md border px-3 py-2 text-[13px] lg:m-2", error || exportState?.status === "failed" ? "border-red-500/40 text-red-900" : "border-gray-alpha-400 text-gray-1000")} role="status">
          {error ??
            (exportState?.status === "rendering"
              ? "Exporting your edits. It takes a minute or two; you can keep editing or leave this page."
              : exportState?.status === "done"
                ? dirty
                  ? "You have changes since the last export."
                  : product
                    ? "Exported: the video now has your edits."
                    : "Exported: the reel's video now has your edits."
                : `The last export failed${exportState?.error ? `: ${exportState.error}` : ""}. Try again.`)}
          {exportState?.status === "done" && !dirty && !error && (
            <a href={`/dashboard/videos/${jobId}`} className="ml-2 font-medium underline underline-offset-2">
              View the {noun}
            </a>
          )}
        </p>
      )}

      {/* Wide screens, as Cardboard's editor: the tools' rail and panel, the preview in the middle, Ask AI always open on
          the right, the timeline below. Phones: the preview, then the tools as tabs, Ask AI among them. */}
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[var(--cols)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-0" style={{ "--cols": columns } as React.CSSProperties}>
        {/* The preview: the clean video with everything the render adds, drawn live, in the reel's own shape (the render
            keeps the clip's), as large as the column allows: on wide screens the column is a size container, and the
            frame is as wide as its height (less the controls under it) allows for the reel's shape. */}
        <div
          ref={stage}
          className={cn(
            // The stage: a panel of its own around the video, as Cardboard's.
            "lg:col-start-3 lg:row-start-1 lg:flex lg:flex-col lg:items-center lg:justify-center lg:overflow-y-auto lg:border-[24px] lg:border-editor-stage lg:bg-black lg:[container-type:size]",
            // Full screen: the same column, the whole screen, on black (the frame sizes itself to it as on wide screens).
            full && "flex flex-col items-center justify-center overflow-y-auto bg-black p-4 [container-type:size] lg:rounded-none lg:border-0 lg:bg-black",
          )}
          style={{ "--shape": draft.edit.width / draft.edit.height } as React.CSSProperties}
        >
          <div
            ref={frameRef}
            className={cn(
              "relative mx-auto w-full shrink-0 overflow-hidden rounded-lg bg-black lg:w-[min(100cqw,calc(100cqh*var(--shape)))] lg:max-w-none lg:rounded-none",
              portrait ? "max-w-[240px] sm:max-w-[300px]" : "max-w-[640px]",
              full && "w-[min(100cqw,calc((100cqh-4rem)*var(--shape)))] max-w-none",
            )}
            style={{ aspectRatio: `${draft.edit.width} / ${draft.edit.height}` }}
          >
            {svg}
            {/* The picture: the video (and, through a transition, its two sides), moved and filtered as one. */}
            <div className="absolute inset-0 isolate" style={{ ...viewTransform(zoom, fx.dx, fx.dy, zoomAim(draft.edit.width, draft.edit.height), fx.rot), filter }}>
              <video
                ref={video}
                src={previewUrl}
                playsInline
                preload="auto"
                className="absolute inset-0 size-full object-cover"
                muted={!ownSound}
                onClick={toggle}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onSeeked={(e) => setTime(e.currentTarget.currentTime)}
                onTimeUpdate={(e) => !playing && setTime(e.currentTarget.currentTime)}
              />
              {joints.length > 0 && <TransitionLayers main={video} src={previewUrl} joints={joints} clock={cutAt} trims={trims} />}
            </div>
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
              aspect={aspect}
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
            {/* Nothing over the video, as Cardboard's: play is in the timeline's header (and Space, or a click on the
                video); captions are edited with a click on them. */}
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
              className={barWidth}
            >
              {"word" in inline && <WordPanel word={inline.word} edit={draft.edit} keyName={keyName} emojisOn={draft.options.emojis && !behind} zoomsOn={draft.options.zooms} sfxOn={draft.options.sfx} cut={cutWords.has(inline.word)} actions={wordActions} dark />}
            </InlineEditor>
          )}
          {/* Play, the time and full screen are in the timeline's header, as Cardboard's editor has them; full screen
              keeps a bar of its own (the timeline isn't there). */}
          {full && (
            <div className="mx-auto mt-3 flex w-[min(100cqw,max(16rem,calc((100cqh-4rem)*var(--shape))))] shrink-0 items-center gap-3 text-white">
              <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="flex size-8 items-center justify-center rounded-full hover:bg-white/10">
                {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
              </button>
              <input type="range" min={0} max={view.duration} step={0.01} value={viewTime} onChange={(e) => seek(cutAt.toUpload(Number(e.target.value)))} className="h-1 min-w-0 flex-1 accent-white" aria-label={`Position in the ${noun}`} />
              <span className="shrink-0 text-xs tabular-nums text-white/70">
                {clock(viewTime)} / {clock(view.duration)}
              </span>
              <button type="button" onClick={toggleFull} aria-label="Exit full screen (F)" title="Exit full screen  F" className="flex size-8 items-center justify-center rounded-md hover:bg-white/10">
                <Minimize className="size-4" />
              </button>
            </div>
          )}
          {behind && <p className="mx-auto mt-2 max-w-[340px] text-center text-xs text-gray-900">In the video, the big words go behind you.</p>}
        </div>

        {/* The tools: a rail of icons on wide screens, under the button that hides or shows their panel; tabs on phones. */}
        <div className="hidden lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:items-center lg:gap-1 lg:border-r lg:border-editor-line lg:bg-editor-panel lg:py-2" role="tablist" aria-label="Tools" aria-orientation="vertical">
          <button
            type="button"
            onClick={() => setLeftOpen((o) => !o)}
            aria-pressed={leftOpen}
            aria-label={leftOpen ? "Hide the tools panel ([)" : "Show the tools panel ([)"}
            title={leftOpen ? "Hide the tools panel  [" : "Show the tools panel  ["}
            className="flex h-8 w-11 items-center justify-center rounded-lg text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000"
          >
            <PanelLeft className="size-4" />
          </button>
          <span className="mx-2 mb-1 h-px bg-gray-alpha-400" aria-hidden />
          {tabs.filter((t) => t !== "Ask AI").map((t) => {
            const Icon = TAB_ICON[t];
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={leftOpen && panelTab === t}
                aria-label={t}
                title={t}
                onClick={() => openTool(t)}
                className={cn("flex size-11 items-center justify-center rounded-lg transition-colors", leftOpen && panelTab === t ? "bg-gray-alpha-200 text-gray-1000" : "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000")}
              >
                <Icon className="size-[18px]" />
              </button>
            );
          })}
        </div>
        <div className="flex h-10 items-center gap-0.5 overflow-x-auto rounded-md border border-gray-alpha-400 bg-background-100 p-1 lg:hidden" role="tablist" aria-label="Edit">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("h-full flex-1 shrink-0 whitespace-nowrap rounded px-2 text-[13px] transition-colors sm:px-3 sm:text-sm", tab === t ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000")}>
              {t}
            </button>
          ))}
        </div>

        {/* What to change: the chosen tool. */}
        <div className={cn("min-w-0 lg:col-start-2 lg:row-start-1 lg:overflow-y-auto lg:border-r lg:border-editor-line lg:bg-editor-panel lg:p-4", tab === "Ask AI" && "hidden lg:block", !leftOpen && "lg:hidden")}>
          <p className="mb-4 hidden text-lg font-semibold tracking-tight text-gray-1000 lg:block">{panelTab}</p>

          {panelTab === "Library" && (
            <MediaPanel
              name={name}
              previewUrl={previewUrl}
              duration={draft.edit.duration}
              cutLength={view.duration}
              width={draft.edit.width}
              height={draft.edit.height}
              broll={brollRows}
              music={draft.edit.audio.music}
              onShot={(index) => {
                setTab("B-roll");
                setTimelinePick({ kind: "broll", index });
                brollActions.select(index);
              }}
              onMusic={() => {
                setTab("Audio");
                setTimelinePick({ kind: "music" });
              }}
            />
          )}

          {panelTab === "Style" && (
            <div className="space-y-5">
              {/* A product video can go without captions; one made before captions came after the agent has them in its picture. */}
              {product && (
                <label className={cn("flex items-start gap-3 rounded-lg border border-gray-alpha-400 p-3 text-sm", product.burned ? "opacity-70" : "cursor-pointer")}>
                  <input type="checkbox" checked={captionsShown} disabled={product.burned} onChange={(e) => setOptions({ captions: e.target.checked })} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
                  <span>
                    <span className="block font-medium text-gray-1000">Captions</span>
                    <span className="mt-0.5 block text-xs text-gray-900">
                      {product.burned ? "This video's captions are part of its picture, so they can't be restyled here. Request a change on the video's page to make a new version with editable captions." : "Word by word from the narration, in any style below."}
                    </span>
                  </span>
                </label>
              )}
              {(!product || captionsShown) && (
                <>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-gray-1000">Templates</p>
                    <TemplateGallery value={matchingTemplate(draft.options.style, draft.options.look, draft.options.fonts)?.id} onPick={(t) => setOptions({ style: t.style, look: { ...t.look }, ...(t.fonts ? { fonts: [...t.fonts] } : {}) })} product={Boolean(product)} />
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-gray-1000">Caption style</p>
                    <StylePicker value={draft.options.style} onChange={(style) => setOptions({ style })} changes={draft.options.look} styles={product ? REEL_STYLES.filter((x) => x !== "behind") : REEL_STYLES} />
                  </div>
                  {behind && (
                    <div>
                      <p className="mb-2 text-[13px] text-gray-900">Big words font</p>
                      <FontPicker value={draft.options.fonts} onChange={(fonts) => setOptions({ fonts })} changes={draft.options.look} />
                    </div>
                  )}
                  <LookEditor style={draft.options.style} changes={draft.options.look} onChange={(change) => update((d) => ({ ...d, options: { ...d.options, look: change(d.options.look) } }), "look")} fonts={draft.options.fonts} showPreview={false} />
                </>
              )}
            </div>
          )}

          {panelTab === "Text" && !captionsShown && <p className="mb-3 rounded-md border border-gray-alpha-400 px-3 py-2 text-[13px] text-gray-900">Captions are off. The words still place emojis, punch-ins, sounds and cuts.</p>}
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
              noun={noun}
            />
          )}

          {panelTab === "Cuts" && <CutsPanel edit={draft.edit} cutLength={view.duration} time={time} selected={selectedTrim} actions={trimActions} canCutPauses={!product} />}

          {panelTab === "Transitions" && <TransitionsPanel places={places} edit={draft.edit} transitions={draft.edit.transitions} joints={joints} cutAt={cutAt} time={time} selected={selectedPlace} sfxOn={draft.options.sfx} actions={transitionActions} noun={noun} />}

          {panelTab === "B-roll" && local && <ServerOnly what="Stock B-roll search" />}

          {panelTab === "B-roll" && !local && <BrollPanel jobId={jobId} rows={brollRows} portrait={draft.edit.height > draft.edit.width} time={viewTime} current={shotHere} selected={selectedShot} actions={brollActions} />}

          {panelTab === "Emojis" && <EmojiPanel edit={draft.edit} lines={lines} time={time} on={draft.options.emojis} behind={behind} actions={emojiActions} noun={noun} />}

          {panelTab === "Effects" && (
            <div className="space-y-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-alpha-400 p-3 text-sm">
                <input type="checkbox" checked={draft.options.zooms} onChange={(e) => setOptions({ zooms: e.target.checked })} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
                <span>
                  <span className="block font-medium text-gray-1000">Punch-in zooms</span>
                  <span className="mt-0.5 block text-xs text-gray-900">{wordless ? "Punch-ins go on words, and this video has no narration. Effects below can zoom at any moment." : `${draft.edit.zooms.length} in this ${noun}. Add, remove or change their strength on any word in the Text tab.`}</span>
                </span>
              </label>
              <EffectsPanel effects={draft.edit.effects} cuts={draft.edit.cuts} time={time} actions={effectActions} noun={noun} />
            </div>
          )}

          {panelTab === "Looks" && <FiltersPanel picture={draft.edit.picture} onChange={setPicture} />}

          {panelTab === "Audio" && <AudioPanel sounds={draft.edit.sounds} hookSound={draft.edit.hookSound} hookOn={hookShown} on={draft.options.sfx} time={time} audio={draft.edit.audio} actions={soundActions} video={product} />}
        </div>

        {/* Ask AI: always open beside the preview on wide screens; a tab on phones. */}
        <div className={cn("min-w-0 lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:flex lg:min-h-0 lg:flex-col", "lg:border-l lg:border-editor-line lg:bg-editor-panel", rightOpen ? "lg:p-3" : "lg:py-2", tab !== "Ask AI" && "hidden")}>
          {rightOpen ? (
            <div className="mb-3 hidden items-center justify-between gap-2 lg:flex">
              {/* The chat's name (its first request), its earlier chats and a new one, as Cardboard's. */}
              <p className="min-w-0 truncate rounded-md bg-gray-alpha-100 px-2 py-1 text-[13px] text-gray-1000" title={chatTitle(chat)}>
                {chatTitle(chat)}
              </p>
              <div className="relative flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => setHistoryOpen((o) => !o)} aria-expanded={historyOpen} aria-label="Earlier chats" title="Earlier chats" className="flex size-7 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000">
                  <History className="size-4" />
                </button>
                <button type="button" onClick={newChat} disabled={!chat.length || asking} aria-label="New chat" title="New chat" className="flex size-7 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000 disabled:opacity-40 disabled:hover:bg-transparent">
                  <Plus className="size-4" />
                </button>
                {historyOpen && (
                  <>
                    <button type="button" aria-label="Close" className="fixed inset-0 z-30 cursor-default" onClick={() => setHistoryOpen(false)} />
                    <div className="absolute right-0 top-9 z-40 w-64 rounded-lg border border-editor-line bg-editor-stage p-1 shadow-xl">
                      {pastChats.length ? (
                        pastChats.map((c, i) => (
                          <button key={i} type="button" onClick={() => openChat(i)} disabled={asking} className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-[13px] text-gray-1000 hover:bg-gray-alpha-100">
                            {chatTitle(c)}
                          </button>
                        ))
                      ) : (
                        <p className="px-2.5 py-1.5 text-[13px] text-gray-900">No earlier chats yet. A new chat (+) keeps this one here.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            // Hidden: its rail, as the tools' on the left: the button that shows it again, then Ask AI itself.
            <div className="hidden lg:flex lg:flex-col lg:items-center lg:gap-1">
              <button type="button" onClick={() => setRightOpen(true)} aria-label="Show Ask AI (])" title="Show Ask AI  ]" className="flex h-8 w-11 items-center justify-center rounded-lg text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000">
                <PanelRight className="size-4" />
              </button>
              <span className="mb-1 h-px w-7 bg-gray-alpha-400" aria-hidden />
              <button type="button" onClick={focusAsk} aria-label="Ask AI" title="Ask AI  ⌘/" className="flex size-11 items-center justify-center rounded-lg text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000">
                <Sparkles className="size-[18px]" />
              </button>
            </div>
          )}
          <div className={cn("min-h-0 lg:flex-1", !rightOpen && "lg:hidden")}>
            {!canAsk ? (
              <ServerOnly what="Ask AI" />
            ) : (
              <ChatPanel
                messages={chat}
                busy={asking}
                live={live}
                onSend={(m) => (setAsked(undefined), void ask(m))}
                onUndo={undoAnswer}
                canUndo={(m) => m.step !== undefined && undoable.has(m.step)}
                draft={asked}
                context={`At ${clock(viewTime)}${selection ? ` · ${selection.label}` : ""}`}
                inputRef={askBox}
                fill
              />
            )}
          </div>
        </div>

        {/* The timeline, under the tools and the preview (Ask AI runs the editor's full height beside it, as
            Cardboard's chat): its own height, up to two fifths of the window; more tracks scroll inside it. */}
        <div className="min-w-0 lg:col-start-1 lg:col-end-4 lg:row-start-2 lg:max-h-[40dvh] lg:overflow-y-auto lg:border-t lg:border-editor-line">
          <ReelTimeline
            edit={draft.edit}
            lines={lines}
            windows={windows}
            broll={brollSpans}
            joints={joints}
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
            video={{ src: previewUrl, name }}
            controls={{
              now: clock(viewTime),
              total: clock(view.duration),
              playing,
              onPlay: toggle,
              onBack: () => seek((([...lines].reverse().find((l) => l.start < time - 0.05)?.start ?? -0.01) + 0.01)),
              onForward: () => {
                const next = lines.find((l) => l.start > time + 0.05);
                if (next) seek(next.start + 0.01);
              },
              onUndo: undo,
              onRedo: redo,
              canUndo: history.past.length > 0,
              canRedo: history.future.length > 0,
              snap,
              onSnap: () => setSnap((on) => (writePrefs({ snap: !on }), !on)),
              full,
              onFull: toggleFull,
            }}
          />
        </div>
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
function InlineEditor({ label, value, maxLength, onChange, onDone, onCancel, className, children }: { label: string; value: string; maxLength: number; onChange: (value: string) => void; onDone: () => void; onCancel: () => void; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("mx-auto mt-2 w-full space-y-2.5 rounded-lg border border-white/10 bg-[#111214] p-2.5 text-white", className ?? "max-w-[300px] lg:max-w-[340px]")}>
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
      <span className="font-medium text-gray-1000">{what}</span> works once your clip is uploaded and its first cut is made. This clip is open straight from your computer, not uploaded.
    </p>
  );
}
