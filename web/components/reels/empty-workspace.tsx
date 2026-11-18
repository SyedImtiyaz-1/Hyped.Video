"use client";
import { ArrowLeft, Film, FolderOpen, LoaderCircle, Plus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { pickAsked, type PickFolder } from "@launchreel/core/project-chat";
import { CLIP_ACCEPT } from "@/components/create/use-clip";
import { Button, ButtonLink } from "@/components/ui/button";
import type { HandedChat } from "@/lib/clip-handoff";
import { cn } from "@/lib/cn";
import { freshSession } from "@/lib/fresh-session";
import { CHAT_WORDS, chatLang } from "./chat-lang";
import { ChatPanel, quoted, type ChatMessage, type WorkStep } from "./chat-panel";

const FOLDERS: Record<PickFolder, string> = { downloads: "Downloads", desktop: "Desktop", videos: "Videos", documents: "Documents", pictures: "Pictures", music: "Music", any: "" };

// The browser's file picker, opening in a folder (Chrome and Edge); elsewhere the file input, wherever it opens.
type OpenPicker = (options: { startIn?: string; types?: { description: string; accept: Record<string, string[]> }[] }) => Promise<{ getFile(): Promise<File> }[]>;
const VIDEO_TYPES = [{ description: "Video", accept: { "video/mp4": [".mp4", ".m4v"], "video/quicktime": [".mov"], "video/webm": [".webm"] } }];

type Asked = { folder: PickFolder; file: string | null; path: string | null };
// Local development only: the dev server runs on this computer, so it brings the file in itself (/api/local/file),
// with no window. Never on the live site, where only the customer can choose a file (until the desktop app,
// docs/DESKTOP_APP.md).
const FROM_COMPUTER = process.env.NODE_ENV === "development";

/** The video asked for, read from this computer by the dev server; null when it isn't there. */
async function fromComputer(asked: Asked): Promise<File | null> {
  await freshSession();
  const res = await fetch("/api/local/file", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: asked.path, folder: asked.folder, name: asked.file }) }).catch(() => null);
  if (!res?.ok) return null;
  const name = decodeURIComponent(res.headers.get("x-file-name") ?? "") || asked.file || "clip.mp4";
  return new File([await res.blob()], name, { type: res.headers.get("content-type") ?? "" });
}

/**
 * A new project before it has anything in it, in the editor's own layout (as Cardboard's empty editor): the library
 * (+ Add), the stage ("Your timeline is empty", Import media), Ask AI, an empty timeline. A clip can be dropped anywhere
 * on it, or picked with Import media, Add or ⌘I / Ctrl+I; `onFile` does the rest, with what was said to Ask AI before
 * it. Ask AI answers from the start (/api/projects/chat). Asked to pull a video from Downloads, the file window opens
 * there at once and the library shows the file asked for until it's chosen (a web page can't take it from the folder
 * itself; a click on it opens the window again); in local development the video comes straight in, with no window.
 * A video Ask AI brings in waits in the library, and a click on it opens it in the editor. An edit asked for now waits
 * for the clip. `busy`: what's happening to the clip (opening, uploading). `note`: what importing does (it may spend a
 * credit).
 */
export function EmptyWorkspace({ onFile, busy, error, note }: { onFile: (file: File, chat: HandedChat) => void; busy?: string | null; error?: string | null; note?: React.ReactNode }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [said, setSaid] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  // While Ask AI works: its steps as they happen.
  const [live, setLive] = useState<WorkStep[] | null>(null);
  // An edit asked for before the clip: typed into Ask AI once the clip is in, for the customer to send.
  const [kept, setKept] = useState("");
  // The clip in the library: `file`, still to open when Ask AI brought it in (a click opens it), or null once opening.
  const [clip, setClip] = useState<{ name: string; size: number; url: string; file: File | null } | null>(null);
  useEffect(() => () => void (clip && URL.revokeObjectURL(clip.url)), [clip]);
  // A video asked for (its folder, and its name when given), in the library until it's chosen; `state`: being brought
  // in from this computer, or not found there (local development).
  const [wanted, setWanted] = useState<(Asked & { state?: "opening" | "missing" }) | null>(null);
  const pick = () => !busy && input.current?.click();
  const spoken = () => said.filter((m) => !m.failed).map(({ from, text }) => ({ from, text }));
  const show = (file: File, waiting: boolean) => setClip({ name: file.name, size: file.size, url: URL.createObjectURL(file), file: waiting ? file : null });
  // Into the editor, with what was said to Ask AI.
  const open = (file: File) => !busy && onFile(file, { messages: spoken(), ask: kept || undefined });
  // Imported (Import media, Add, a drop): it opens at once.
  const take = (file: File) => {
    if (busy) return;
    show(file, false);
    onFile(file, { messages: spoken(), ask: kept || undefined });
  };
  // Brought in by Ask AI: it waits in the library for a click.
  const bring = (file: File) => {
    show(file, true);
    setWanted(null);
  };
  const pickFrom = async (folder: PickFolder) => {
    const browser = window as unknown as { showOpenFilePicker?: OpenPicker };
    if (folder === "any" || !browser.showOpenFilePicker) return pick();
    try {
      const [handle] = await browser.showOpenFilePicker({ startIn: folder, types: VIDEO_TYPES });
      if (handle) bring(await handle.getFile());
    } catch (err) {
      // Closed without a pick: nothing to do. Refused (a folder it may not open): the file input instead.
      if ((err as Error)?.name !== "AbortError") pick();
    }
  };
  const ask = async (message: string) => {
    const history = spoken();
    const asked = busy ? null : pickAsked(message);
    // Plainly asked to bring a video in: in local development it comes straight from this computer; elsewhere the
    // picker opens now, while the Enter or click still counts as the customer's.
    const direct = Boolean(asked) && FROM_COMPUTER;
    if (asked) {
      setWanted({ ...asked, state: direct ? "opening" : undefined });
      if (!direct) void pickFrom(asked.folder);
    }
    const lang = chatLang(message);
    const t = CHAT_WORDS[lang];
    setSaid((s) => [...s, { from: "you", text: message, lang }]);
    setAsking(true);
    // Its steps: shown live as they happen (done, under way, to come), then under the answer's "Worked for": what
    // was asked, what happened to the video asked for, what was kept.
    const started = Date.now();
    const steps: WorkStep[] = [{ title: t.read, items: [quoted(message)] }];
    const progress = (active: WorkStep, ...todo: WorkStep[]) => setLive([...steps, { ...active, status: "active" }, ...todo.map((t) => ({ ...t, status: "pending" as const }))]);
    const answering: WorkStep = { title: t.writing };
    const where = asked ? FOLDERS[asked.folder] || "your folders" : "";
    let file: File | null = null;
    try {
      if (asked && direct) {
        progress({ title: t.lookingIn(where), items: [asked.file ? t.lookingFor(asked.file) : t.newest] }, answering);
        file = await fromComputer(asked);
        if (file) bring(file);
        else setWanted({ ...asked, state: "missing" });
        steps.push(file ? { title: t.found(file.name), items: [t.inFolder(where), t.library] } : { title: t.lookedIn(where), items: [asked.file ? t.noneNamed(asked.file) : t.noVideo] });
      } else if (asked) {
        steps.push({ title: t.opened(where), items: [t.toChoose] });
      }
      progress(answering);
      await freshSession();
      const res = await fetch("/api/projects/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history, kept, opened: asked && !direct ? asked.folder : null, found: file?.name ?? null }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; pick?: PickFolder | null; file?: string | null; keep?: string | null; error?: string };
      // Signed out on this page (the sign-in middleware answers 404): a reload signs it in again.
      if (res.status === 401 || res.status === 404) throw new Error("Your sign-in on this page has expired. Reload the page, then ask again.");
      if (!res.ok || !data.reply) throw new Error(data.error ?? "The assistant didn't answer. Try again in a moment.");
      if (typeof data.keep === "string") setKept(data.keep);
      if (data.keep && data.keep !== kept) steps.push({ title: t.kept, items: [data.keep] });
      if (data.pick && !file) setWanted((w) => ({ folder: data.pick!, file: data.file ?? w?.file ?? null, path: w?.path ?? null, state: w?.state }));
      setSaid((s) => [...s, { from: "ai", text: data.reply!, work: { ms: Date.now() - started, steps }, lang }]);
    } catch (err) {
      setSaid((s) => [...s, { from: "ai", text: err instanceof Error ? err.message : "The assistant didn't answer.", failed: true }]);
    } finally {
      setAsking(false);
      setLive(null);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        pick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const drop = {
    onDragOver: (e: React.DragEvent) => e.dataTransfer.types.includes("Files") && (e.preventDefault(), setDragging(true)),
    onDragLeave: (e: React.DragEvent) => e.currentTarget === e.target && setDragging(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) take(file);
    },
  };

  return (
    // Wide screens: the window's height, as the editor itself (the timeline stays in view).
    <div className="flex w-full flex-col px-4 py-4 sm:px-6 lg:h-dvh lg:min-h-[520px] lg:p-0" {...drop}>
      <input ref={input} type="file" accept={CLIP_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (e.target.files?.[0] && take(e.target.files[0]), (e.target.value = ""))} />
      <div className="mb-4 flex shrink-0 items-center gap-2 lg:mb-0 lg:h-12 lg:border-b lg:border-editor-line lg:px-3">
        <ButtonLink href="/dashboard" variant="tertiary" size="sm" aria-label="Back to the dashboard">
          <ArrowLeft />
        </ButtonLink>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium text-gray-1000">Untitled project</h1>
          <p className="truncate text-xs text-gray-900">Nothing in it yet</p>
        </div>
        <Button disabled title="Import a clip first" className="h-8 border-transparent bg-gray-1000 px-3 text-background-100 disabled:opacity-50">
          Export
        </Button>
      </div>

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[56px_minmax(0,320px)_minmax(0,1fr)_minmax(0,360px)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-0">
        <div className="hidden lg:flex lg:flex-col lg:items-center lg:gap-1 lg:border-r lg:border-editor-line lg:bg-editor-panel lg:py-2">
          <span className="flex size-11 items-center justify-center rounded-lg bg-gray-alpha-200 text-gray-1000" title="Library">
            <FolderOpen className="size-[18px]" />
          </span>
        </div>

        {/* The library: what's in the project (nothing yet). */}
        <div className="order-2 min-w-0 lg:order-none lg:overflow-y-auto lg:border-r lg:border-editor-line lg:bg-editor-panel lg:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-lg font-semibold tracking-tight text-gray-1000">Library</p>
            <Button variant="secondary" size="sm" onClick={pick} disabled={Boolean(busy)}>
              <Plus />
              Add
            </Button>
          </div>
          {clip ? (
            // A video Ask AI brought in waits here: a click opens it in the editor.
            <button
              type="button"
              onClick={() => clip.file && open(clip.file)}
              disabled={!clip.file || Boolean(busy)}
              className="block w-full rounded-lg border border-gray-alpha-400 p-2 text-left transition-colors enabled:hover:border-gray-1000 enabled:hover:bg-gray-alpha-100"
            >
              <video src={`${clip.url}#t=0.5`} muted playsInline preload="metadata" className="aspect-video w-full rounded-md bg-black object-contain" />
              <span className="mt-2 block truncate text-[13px] font-medium text-gray-1000" title={clip.name}>
                {clip.name}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-900" aria-live="polite">
                {busy ? (
                  <>
                    <LoaderCircle className="size-3 animate-spin" />
                    {busy}
                  </>
                ) : error ? (
                  <span className="text-red-900">Couldn&apos;t open it: pick another clip</span>
                ) : clip.file ? (
                  `${(clip.size / 1048576).toFixed(1)} MB · Click to open it in the editor`
                ) : (
                  `${(clip.size / 1048576).toFixed(1)} MB`
                )}
              </span>
            </button>
          ) : wanted ? (
            // The video asked for, until it's chosen: a click opens the file window again.
            <button type="button" onClick={() => void pickFrom(wanted.folder)} disabled={Boolean(busy) || wanted.state === "opening"} className="flex w-full flex-col items-center rounded-lg border border-dashed border-gray-alpha-500 px-4 py-8 text-center transition-colors hover:border-gray-1000 hover:bg-gray-alpha-100 disabled:hover:border-gray-alpha-500 disabled:hover:bg-transparent">
              <span className="flex size-10 items-center justify-center rounded-lg bg-gray-alpha-100 text-gray-1000">
                {wanted.state === "opening" ? <LoaderCircle className="size-4 animate-spin" /> : <Film className="size-4" />}
              </span>
              <span className="mt-3 max-w-full truncate text-sm font-medium text-gray-1000" title={wanted.file ?? undefined}>
                {wanted.file ?? "Your video"}
              </span>
              <span className="mt-1 text-xs text-gray-900" aria-live="polite">
                {wanted.state === "opening"
                  ? `Bringing it in from ${FOLDERS[wanted.folder] || "your computer"}…`
                  : `${wanted.state === "missing" ? `Not found in ${FOLDERS[wanted.folder] || "your folders"}. ` : ""}${wanted.folder === "any" ? "Choose it in the file window" : `Choose it in ${FOLDERS[wanted.folder]}`} to open it here.`}
              </span>
            </button>
          ) : (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-gray-alpha-500 px-4 py-10 text-center">
              <span className="flex size-10 items-center justify-center rounded-lg bg-gray-alpha-100 text-gray-900">
                <Upload className="size-4" />
              </span>
              <p className="mt-3 text-sm font-medium text-gray-1000">No media yet</p>
              <p className="mt-1 text-xs text-gray-900">Your clip appears here. Photos, audio and more clips in one video are coming.</p>
            </div>
          )}
        </div>

        {/* The stage: import a clip to start. */}
        <div className={cn("order-1 flex min-h-[320px] min-w-0 flex-col items-center justify-center rounded-xl border bg-black px-6 py-12 text-center text-white transition-colors lg:order-none lg:min-h-0 lg:overflow-auto lg:rounded-none lg:border-[24px] lg:border-editor-stage lg:bg-black", dragging ? "border-brand bg-brand/10 lg:bg-brand/10 lg:ring-2 lg:ring-inset lg:ring-brand" : "border-gray-alpha-400")}>
          {busy ? (
            <>
              <LoaderCircle className="size-6 animate-spin text-white/70" />
              <p className="mt-3 text-base font-medium" role="status">
                {busy}
              </p>
            </>
          ) : (
            <>
              <Upload className="size-6 text-white/70" />
              <p className="mt-3 text-base font-medium">{dragging ? "Drop it to start" : "Your timeline is empty"}</p>
              <p className="mt-1 text-[13px] text-white/60">Import a clip to start your first cut. MP4, MOV or WebM.</p>
              <div className="mt-5 flex items-center gap-2">
                <button type="button" onClick={pick} className="flex h-9 items-center gap-2 rounded-md bg-white px-3.5 text-sm font-medium text-black hover:bg-white/90">
                  <Upload className="size-4" />
                  Import media
                </button>
                <kbd className="rounded border border-white/20 px-1.5 py-0.5 font-sans text-[11px] text-white/60">Ctrl I</kbd>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="mt-4 max-w-sm text-[13px] text-red-300">
              {error}
            </p>
          )}
          {note && !busy && <p className="mt-4 max-w-sm text-xs text-white/50">{note}</p>}
        </div>

        {/* Ask AI, from the start: the editor's full height, beside the timeline too. */}
        <div className="order-3 flex min-w-0 flex-col lg:order-none lg:row-span-2 lg:min-h-0 lg:border-l lg:border-editor-line lg:bg-editor-panel lg:p-3">
          {/* As the editor's: the chat's name (its first request) and a new chat. */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate rounded-md bg-gray-alpha-100 px-2 py-1 text-[13px] text-gray-1000">{said.find((m) => m.from === "you")?.text ?? "Ask AI"}</p>
            <button type="button" onClick={() => (setSaid([]), setKept(""))} disabled={!said.length || asking} aria-label="New chat" title="New chat" className="flex size-7 shrink-0 items-center justify-center rounded-md text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000 disabled:opacity-40 disabled:hover:bg-transparent">
              <Plus className="size-4" />
            </button>
          </div>
          <div className="min-h-0 lg:flex-1">
            <ChatPanel
              messages={said}
              busy={asking}
              live={live}
              onSend={(m) => void ask(m)}
              onUndo={() => {}}
              canUndo={() => false}
              context={kept ? `Waiting for your clip: ${kept}` : undefined}
              fill
            />
          </div>
        </div>

        {/* The timeline, empty, under the library and the stage. */}
        <div className="order-4 min-w-0 rounded-lg border border-gray-alpha-400 bg-background-100 lg:order-none lg:col-start-1 lg:col-end-4 lg:row-start-2 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:border-t lg:border-editor-line lg:bg-editor-panel">
          <div className="border-b border-gray-alpha-400 px-3 py-1.5 text-xs text-gray-900">Timeline</div>
          <div className="flex h-6 border-b border-gray-alpha-400 pl-16">
            {[0, 5, 10, 15, 20, 25, 30].map((t) => (
              <span key={t} className="flex-1 border-l border-gray-alpha-400 pl-1 text-[10px] leading-6 text-gray-900">
                0:{String(t).padStart(2, "0")}
              </span>
            ))}
          </div>
          <div className="flex h-16 items-center justify-center text-xs text-gray-900">Drop a clip anywhere to start</div>
        </div>
      </div>
    </div>
  );
}
