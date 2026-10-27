"use client";
import { ArrowLeft, ArrowRight, Check, Clapperboard, GitBranch, Globe, LayoutTemplate, MicOff, Pause, Pencil, Play, X, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { creditsFor, LONG_VIDEO_SECONDS } from "@launchreel/core/pricing";
import type { Template } from "@launchreel/core/templates";
import { voiceById, VOICES, type VoiceId, type VoiceOption } from "@launchreel/core/voices";
import { cn } from "@/lib/cn";
import { hostOf, plural } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { PrivateRepoToken, saveRepoToken, type RepoTokenSetup } from "./private-repo-token";
import { normalizeSourceUrl } from "@/lib/source-url";

export const TONES = [
  { value: "", label: "Auto", hint: "We pick what fits your product" },
  {
    value: "polished",
    label: "Polished",
    hint: "Serious, elegant, restrained",
  },
  { value: "default", label: "Playful", hint: "Punchy, fun, clean" },
  { value: "yc-parody", label: "YC parody", hint: "A deadpan startup launch" },
  { value: "cinematic", label: "Cinematic", hint: "Trailer-scale, big claims" },
  { value: "app-store", label: "App Store", hint: "Clean feature cards" },
  { value: "deadpan", label: "Deadpan", hint: "Calm, dry, understated" },
  { value: "chaotic", label: "Chaotic", hint: "Fast, loud, all caps" },
];

export const FORMATS = [
  {
    value: "landscape",
    label: "Landscape",
    ratio: "16:9",
    where: "Product Hunt, YouTube, your site",
    w: 32,
    h: 18,
  },
  {
    value: "vertical",
    label: "Vertical",
    ratio: "9:16",
    where: "TikTok, Reels, Shorts",
    w: 14,
    h: 24,
  },
  {
    value: "square",
    label: "Square",
    ratio: "1:1",
    where: "LinkedIn, X",
    w: 22,
    h: 22,
  },
];

const VIDEO_TYPE_OPTIONS = [
  {
    value: "launch",
    label: "Launch video",
    hint: "Announce it and build hype",
  },
  {
    value: "demo",
    label: "Product demo",
    hint: "Show how it works, step by step",
  },
  {
    value: "feature",
    label: "Feature spotlight",
    hint: "One feature, in depth",
  },
] as const;
type VideoTypeValue = (typeof VIDEO_TYPE_OPTIONS)[number]["value"];

export const MUSIC_OPTIONS = [
  {
    value: "upbeat",
    label: "Upbeat music",
    hint: "A licensed track and sound effects",
  },
  { value: "composed", label: "AI-composed", hint: "An original soundtrack" },
  { value: "none", label: "No music", hint: "Subtle sound effects only" },
] as const;
type MusicValue = (typeof MUSIC_OPTIONS)[number]["value"];

// Two quality tiers. Customers see only these names; which engine runs each is server config.
export const QUALITY_OPTIONS = [
  {
    value: "standard",
    label: "Standard",
    hint: "Polished motion, music and share copy at our lowest price. Great for social posts, updates and demos.",
    icon: <Zap />,
  },
  {
    value: "studio",
    label: "Studio",
    hint: "Our most advanced director: richer storytelling and motion design, for your big launch.",
    icon: <Clapperboard />,
  },
] as const;
type QualityValue = (typeof QUALITY_OPTIONS)[number]["value"];

const SOURCES = [
  { value: "WEBSITE", label: "Website", icon: <Globe />, hint: "Any public page. We read it the way a visitor sees it." },
  { value: "GITHUB", label: "GitHub repo", icon: <GitBranch />, hint: "Public or private. For a private repo, add a read-only token below." },
] as const;

// One click adds a proven direction to the brief.
const DIRECTION_IDEAS = ["Make it feel like a keynote", "Fast cuts, bold type", "Show the signup flow", "Focus on the AI features", "End on the pricing page"];

// 15–30s: a teaser for social. 60–90s: a full launch video for your homepage.
export const LENGTHS = [15, 20, 30, 60, 90];

// The form is a wizard: one question per step, so nothing needs scrolling to find.
const STEPS = [
  {
    label: "Product",
    title: "What should the video show?",
    description: "Paste your website or GitHub repo. We read it and use your real UI, copy, colors and fonts.",
  },
  {
    label: "Story",
    title: "What are you making?",
    description: "Pick a type, then tell us what to say. It's all optional, but a clear brief makes a much better video.",
  },
  {
    label: "Look",
    title: "How should it look?",
    description: "Where it will be posted, how long it runs, and its style.",
  },
  {
    label: "Sound",
    title: "How should it sound?",
    description: "Add a narrator and captions, and choose the music.",
  },
  {
    label: "Review",
    title: "Review and make your video",
    description: "Check your choices, pick the quality, and start the render.",
  },
] as const;
const LAST = STEPS.length - 1;

/** Makes "acme.com" a full URL; returns null when it still isn't one. */
const normalizeUrl = normalizeSourceUrl;

export function NewVideoForm({
  credits,
  initialUrl,
  repoToken,
  studioAvailable,
  template,
}: {
  credits: number;
  initialUrl: string;
  repoToken: RepoTokenSetup;
  studioAvailable: boolean;
  /** Started from a template: its choices fill the steps (all still editable) and its beats shape the story. */
  template?: Template | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [sourceType, setSourceType] = useState<"WEBSITE" | "GITHUB">(initialUrl.includes("github.com") ? "GITHUB" : "WEBSITE");
  const [url, setUrl] = useState(initialUrl);
  const [templateOn, setTemplateOn] = useState(Boolean(template));
  const [tone, setTone] = useState(template?.tone ?? "");
  const [format, setFormat] = useState<string>(template?.format ?? "landscape");
  const [duration, setDuration] = useState(template?.durationSec ?? 20);
  const [notes, setNotes] = useState("");
  const [videoType, setVideoType] = useState<VideoTypeValue>(template?.videoType ?? "launch");
  const [music, setMusic] = useState<MusicValue>(template?.music ?? "upbeat");
  const [quality, setQuality] = useState<QualityValue>("standard");
  const [voice, setVoice] = useState<VoiceId | null>(template?.voice ?? null);
  const [captions, setCaptions] = useState(true);
  const preview = useVoicePreview();
  const [launching, setLaunching] = useState("");
  const [audience, setAudience] = useState("");
  const [highlights, setHighlights] = useState("");
  const [cta, setCta] = useState("");
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    message: string;
    upgrade?: boolean;
  } | null>(null);
  const [token, setToken] = useState("");
  const [replacingToken, setReplacingToken] = useState(false);
  const cost = creditsFor("newVideo", duration, quality);
  const activeTemplate = templateOn ? (template ?? null) : null;
  const enough = credits >= cost;
  const top = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const furthestRef = useRef(0);
  furthestRef.current = furthest;

  // Each step gets its own history entry, so the browser's (or the phone's) back gesture goes back one step.
  useEffect(() => {
    const onPop = () => {
      const n = Number(new URLSearchParams(window.location.search).get("step")) - 1;
      setStep((current) => (Number.isInteger(n) && n >= 0 ? Math.min(n, furthestRef.current) : current));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // A new step starts at the top, with focus on its question (for keyboards and screen readers).
  useEffect(() => {
    if (!moved.current) return;
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  function goTo(n: number) {
    setError(null);
    moved.current = true;
    setStep(n);
    setFurthest((f) => Math.max(f, n));
    const params = new URLSearchParams(window.location.search);
    params.set("step", String(n + 1));
    window.history.pushState(null, "", `?${params}`);
  }

  function next() {
    if (step === 0 && !normalizeUrl(url)) {
      return setError({
        message: sourceType === "GITHUB" ? "Enter a repo URL like https://github.com/owner/repo" : "Enter a website URL like https://yourproduct.com",
      });
    }
    goTo(step === 0 && activeTemplate ? LAST : step + 1);
  }

  function onUrl(value: string) {
    setUrl(value);
    if (error) setError(null);
    if (/github\.com\//i.test(value)) setSourceType("GITHUB");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step < LAST) return next(); // Enter moves to the next step
    const normalized = normalizeUrl(url);
    if (!normalized) return goTo(0);
    if (!owner)
      return setError({
        message: "Confirm that you own this product or may promote it.",
      });
    setBusy(true);
    setError(null);
    try {
      // A private repo's token is checked with GitHub and encrypted in this browser before the video starts.
      if (sourceType === "GITHUB" && token.trim()) {
        const problem = await saveRepoToken(token.trim(), normalized, repoToken);
        if (problem) return setError({ message: problem });
        setToken("");
        setReplacingToken(false);
      }
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl: normalized,
          tone: tone || undefined,
          format,
          durationSec: duration,
          notes: notes.trim() || undefined,
          videoType,
          music,
          quality,
          voice,
          captions,
          brief: {
            launching: launching.trim() || undefined,
            audience: audience.trim() || undefined,
            highlights: highlights
              .split("\n")
              .map((h) => h.trim())
              .filter(Boolean)
              .slice(0, 3),
            cta: cta.trim() || undefined,
          },
          template: activeTemplate?.id,
          ownershipConfirmed: true,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        return setError({
          message: data.error ?? "Could not start the video",
          upgrade: data.upgrade,
        });
      router.push(`/dashboard/videos/${data.id}`);
    } catch {
      setError({ message: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function removeToken() {
    setBusy(true);
    try {
      await fetch("/api/repo-token", { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const formatOption = FORMATS.find((f) => f.value === format)!;
  const chosenVoice = voiceById(voice);
  const briefText = [launching, audience && `for ${audience}`].filter(Boolean).join(", ");

  return (
    <form onSubmit={submit} className="scroll-mt-20 space-y-5" ref={top}>
      {activeTemplate && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-gray-alpha-400 bg-background-100 px-3 py-2 text-sm">
          <LayoutTemplate className="size-4 shrink-0 text-gray-900" />
          <span className="min-w-0 flex-1">
            Template: <span className="font-medium text-gray-1000">{activeTemplate.name}</span>
            <span className="hidden text-gray-900 sm:inline"> · {activeTemplate.use}</span>
          </span>
          <Link href={`/dashboard/recipes${url ? `?url=${encodeURIComponent(url)}` : ""}`} className="text-[13px] text-gray-900 underline-offset-2 hover:text-gray-1000 hover:underline">
            Change
          </Link>
          <button type="button" onClick={() => setTemplateOn(false)} className="flex items-center gap-1 text-[13px] text-gray-900 hover:text-gray-1000" aria-label="Remove the template">
            <X className="size-3.5" />
            Remove
          </button>
        </div>
      )}
      <Stepper step={step} furthest={furthest} onJump={goTo} />

      <Card>
        <div className="border-b border-gray-alpha-400 px-5 py-4">
          <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold tracking-tight text-gray-1000 outline-none">
            {STEPS[step].title}
          </h2>
          <p className="mt-0.5 text-sm text-gray-900">{STEPS[step].description}</p>
        </div>

        <CardContent className="space-y-5">
          {step === 0 && (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-alpha-400 bg-background-100 p-1" role="radiogroup" aria-label="Source">
                {SOURCES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={sourceType === o.value}
                    onClick={() => setSourceType(o.value)}
                    className={cn(
                      "flex h-10 items-center justify-center gap-2 rounded-md px-2 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
                      sourceType === o.value ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000",
                    )}
                  >
                    {o.icon}
                    <span className="truncate">{o.label}</span>
                  </button>
                ))}
              </div>
              <div>
                <Label htmlFor="sourceUrl">{sourceType === "GITHUB" ? "Repository URL" : "Website URL"}</Label>
                <Input
                  id="sourceUrl"
                  value={url}
                  onChange={(e) => onUrl(e.target.value)}
                  prefix={sourceType === "GITHUB" ? <GitBranch /> : <Globe />}
                  placeholder={sourceType === "GITHUB" ? "https://github.com/owner/repo" : "https://yourproduct.com"}
                  autoFocus
                  autoComplete="url"
                  inputMode="url"
                />
                <p className="mt-2 text-[13px] text-gray-900">{SOURCES.find((o) => o.value === sourceType)!.hint}</p>
              </div>
              {sourceType === "GITHUB" && (
                <PrivateRepoToken
                  setup={repoToken}
                  token={token}
                  onToken={(value) => {
                    setToken(value);
                    if (error) setError(null);
                  }}
                  replacing={replacingToken}
                  onReplace={() => setReplacingToken(true)}
                  onRemove={removeToken}
                  busy={busy}
                />
              )}
            </>
          )}

          {step === 1 && (
            <>
              {activeTemplate && (
                <div className="rounded-lg border border-gray-alpha-400 bg-background-200 px-4 py-3">
                  <p className="text-[13px] font-medium text-gray-1000">The story this template tells</p>
                  <ol className="mt-2 space-y-1 text-[13px] text-gray-900">
                    {activeTemplate.beats.map((b) => (
                      <li key={b.label}>
                        <span className="tabular-nums text-gray-1000">
                          {b.from}-{b.to}s {b.label}:
                        </span>{" "}
                        {b.text}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-2 text-[12px] text-gray-900">Add your own words below and we&apos;ll fit them into these beats.</p>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Video type">
                {VIDEO_TYPE_OPTIONS.map((t) => (
                  <Choice key={t.value} selected={videoType === t.value} onClick={() => setVideoType(t.value)} title={t.label} hint={t.hint} compact />
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="launching">What&apos;s new?</Label>
                  <Input id="launching" value={launching} onChange={(e) => setLaunching(e.target.value)} maxLength={200} placeholder="Our v2: AI search across all your docs" />
                </div>
                <div>
                  <Label htmlFor="audience">Who is it for?</Label>
                  <Input id="audience" value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={200} placeholder="Busy product teams" />
                </div>
                <div>
                  <Label htmlFor="highlights">What should it show? (up to 3, one per line)</Label>
                  <Textarea id="highlights" value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={3} maxLength={500} placeholder={"Instant search\nOne-click summaries\nSlack integration"} />
                </div>
                <div>
                  <Label htmlFor="cta">How should it end?</Label>
                  <Input id="cta" value={cta} onChange={(e) => setCta(e.target.value)} maxLength={160} placeholder="Start free at yourproduct.com" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Anything else? (optional)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Make it feel like a keynote. Keep the copy short and confident." />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {DIRECTION_IDEAS.map((idea) => (
                    <button
                      key={idea}
                      type="button"
                      onClick={() => setNotes((n) => (n.trim() ? `${n.trim().replace(/[.!]?$/, ".")} ${idea}.` : `${idea}.`))}
                      className="rounded-full border border-gray-alpha-400 px-3 py-2 text-xs text-gray-900 transition-colors hover:border-gray-alpha-500 hover:text-gray-1000 sm:px-2.5 sm:py-1"
                    >
                      + {idea}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label>Format</Label>
                <div className="grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="Format">
                  {FORMATS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      role="radio"
                      aria-checked={format === f.value}
                      aria-label={`${f.label} ${f.ratio}: ${f.where}`}
                      onClick={() => setFormat(f.value)}
                      className={cn(
                        "relative flex flex-col items-center gap-2 rounded-lg border px-2 py-3 text-center transition-colors sm:flex-row sm:items-start sm:gap-3 sm:p-4 sm:text-left",
                        format === f.value ? "border-gray-1000 bg-gray-alpha-100 ring-1 ring-gray-1000" : "border-gray-alpha-400 bg-background-100 hover:border-gray-alpha-500 hover:bg-gray-alpha-100",
                      )}
                    >
                      <span className={cn("flex h-7 items-center justify-center sm:mt-0.5 sm:h-6 sm:min-w-8", format === f.value ? "text-gray-1000" : "text-gray-900")}>
                        <span className="block rounded-[3px] border-[1.5px] border-current" style={{ width: f.w, height: f.h }} />
                      </span>
                      <span className="min-w-0 sm:pr-5">
                        <span className="block text-sm font-medium text-gray-1000">{f.label}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-gray-900">
                          {f.ratio}
                          <span className="hidden sm:inline"> · {f.where}</span>
                        </span>
                      </span>
                      {format === f.value && (
                        <span className="absolute right-2 top-2 hidden size-4 items-center justify-center rounded-full bg-gray-1000 text-background-100 sm:flex">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Length</Label>
                <div className="flex h-11 w-full items-center gap-0.5 rounded-md border border-gray-alpha-400 bg-background-100 p-1 sm:inline-flex sm:h-10 sm:w-auto" role="radiogroup" aria-label="Length">
                  {LENGTHS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={duration === s}
                      onClick={() => setDuration(s)}
                      className={cn(
                        "h-full flex-1 rounded px-2 text-sm tabular-nums transition-colors sm:flex-none sm:px-4",
                        duration === s ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000",
                      )}
                    >
                      {s}s
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[13px] text-gray-900">
                  {duration > LONG_VIDEO_SECONDS
                    ? "Full launch video for your homepage: hook, problem, features and a call to action. Can take up to an hour."
                    : "A teaser for social feeds. Ready in about 10–20 minutes."}
                </p>
              </div>
              <div>
                <Label>Tone</Label>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label="Tone">
                  {TONES.map((t) => (
                    <Choice key={t.value || "auto"} selected={tone === t.value} onClick={() => setTone(t.value)} title={t.label} hint={t.hint} compact />
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label>Voiceover</Label>
                <p className="-mt-0.5 mb-3 text-[13px] text-gray-900">A narrator reads a script written for your video. Included, no extra credits. Press ▶ to hear a voice.</p>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3" role="radiogroup" aria-label="Voiceover">
                  <div className="sm:col-span-2 md:col-span-3">
                    <Choice selected={voice === null} onClick={() => setVoice(null)} icon={<MicOff />} title="No voiceover" hint="Music and on-screen text only" compact />
                  </div>
                  {VOICES.map((v) => (
                    <VoiceCard key={v.id} voice={v} selected={voice === v.id} onSelect={() => setVoice(v.id)} playing={preview.playing === v.id} onPreview={() => preview.toggle(v.id)} />
                  ))}
                </div>
                {voice && (
                  <div className="mt-3 space-y-2 rounded-lg border border-gray-alpha-400 p-4">
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                      <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
                      <span className="text-gray-1000">
                        Burn captions into the video
                        <span className="block text-[13px] text-gray-900">Word-by-word, so it works with the sound off. You also get an SRT file for YouTube and LinkedIn.</span>
                      </span>
                    </label>
                    <p className="text-[13px] text-gray-900">The voice is AI-generated. Let your viewers know, for example with &ldquo;AI voiceover&rdquo; in your post.</p>
                  </div>
                )}
              </div>
              <div>
                <Label>Music</Label>
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Music">
                  {MUSIC_OPTIONS.map((m) => (
                    <Choice key={m.value} selected={music === m.value} onClick={() => setMusic(m.value)} title={m.label} hint={m.hint} compact />
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <dl className="divide-y divide-gray-alpha-400 rounded-lg border border-gray-alpha-400 text-sm">
                {activeTemplate && (
                  <Summary label="Template" onEdit={() => goTo(1)}>
                    {activeTemplate.name}
                    <span className="text-gray-900"> · {activeTemplate.beats.length} beats</span>
                  </Summary>
                )}
                <Summary label="Product" onEdit={() => goTo(0)}>
                  {sourceType === "GITHUB" ? <GitBranch className="mr-1.5 inline size-3.5 text-gray-900" /> : <Globe className="mr-1.5 inline size-3.5 text-gray-900" />}
                  {normalizeUrl(url) ? hostOf(normalizeUrl(url)!) : url}
                </Summary>
                <Summary label="Story" onEdit={() => goTo(1)}>
                  {VIDEO_TYPE_OPTIONS.find((t) => t.value === videoType)!.label}
                  <span className="text-gray-900"> · {briefText || "no brief, we'll decide"}</span>
                </Summary>
                <Summary label="Look" onEdit={() => goTo(2)}>
                  {formatOption.label} {formatOption.ratio} · {duration}s · {TONES.find((t) => t.value === tone)!.label} tone
                </Summary>
                <Summary label="Sound" onEdit={() => goTo(3)}>
                  {chosenVoice ? `${chosenVoice.name} voiceover${captions ? ", with captions" : ""}` : "No voiceover"} · {MUSIC_OPTIONS.find((m) => m.value === music)!.label}
                </Summary>
              </dl>

              <div>
                <Label>Quality</Label>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Quality">
                  {QUALITY_OPTIONS.map((q) => {
                    // Studio runs on an engine that isn't switched on yet: shown, but not selectable.
                    const soon = q.value === "studio" && !studioAvailable;
                    return (
                      <Choice
                        key={q.value}
                        selected={quality === q.value}
                        onClick={() => setQuality(q.value)}
                        disabled={soon}
                        icon={q.icon}
                        title={soon ? `${q.label} · Coming soon` : `${q.label} · ${plural(creditsFor("newVideo", duration, q.value), "credit")}`}
                        hint={q.hint}
                      />
                    );
                  })}
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  aria-label="I own this product or I'm authorized to promote it"
                  checked={owner}
                  onChange={(e) => setOwner(e.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]"
                />
                <span className="text-gray-1000">
                  I own this product or I&apos;m authorized to promote it.
                  <span className="block text-[13px] text-gray-900">Videos show your product&apos;s UI and copy only: no real people, no cloned voices.</span>
                </span>
              </label>
            </>
          )}
        </CardContent>

        {/* Back / Next. On phones it stays in view above the bottom navigation, with any error right above the buttons. */}
        <div className="sticky bottom-[5.25rem] z-20 rounded-b-xl border-t border-gray-alpha-400 bg-background-100/95 shadow-[0_-10px_24px_-16px_rgb(0_0_0/0.35)] backdrop-blur md:static md:bg-background-100 md:shadow-none md:backdrop-blur-none">
          {error && (
            <div className="px-5 pt-3 text-[13px] text-red-900" role="alert">
              {error.message}
              {error.upgrade && (
                <>
                  {" "}
                  <Link href="/dashboard/billing" className="underline underline-offset-2">
                    Get more credits
                  </Link>
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 px-5 py-4">
            {step > 0 ? (
              <Button type="button" onClick={() => goTo(step - 1)} disabled={busy}>
                <ArrowLeft />
                Back
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              {step >= 2 && (
                <span className={cn("text-[13px] tabular-nums", enough ? "text-gray-900" : "text-amber-900")}>
                  {plural(cost, "credit")}
                  <span className="hidden sm:inline"> · you have {credits}</span>
                </span>
              )}
              {step < LAST ? (
                <Button type="submit" variant="primary">
                  {step === 0 && activeTemplate ? "Review" : "Next"}
                  <ArrowRight />
                </Button>
              ) : enough ? (
                <Button type="submit" variant="primary" disabled={busy}>
                  {busy ? "Starting…" : "Make video"}
                  {!busy && <ArrowRight />}
                </Button>
              ) : (
                <ButtonLink href="/dashboard/billing" variant="primary">
                  Get credits
                </ButtonLink>
              )}
            </div>
          </div>
        </div>
      </Card>
    </form>
  );
}

/** Progress through the steps. Steps already reached can be revisited with a click. */
function Stepper({ step, furthest, onJump }: { step: number; furthest: number; onJump: (n: number) => void }) {
  return (
    <nav aria-label="Steps">
      {/* Phones: which step, and how far along. */}
      <div className="sm:hidden">
        <p className="text-[13px] text-gray-900">
          Step {step + 1} of {STEPS.length} · <span className="font-medium text-gray-1000">{STEPS[step].label}</span>
        </p>
        <div className="mt-2 flex gap-1" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.label} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-gray-1000" : "bg-gray-alpha-300")} />
          ))}
        </div>
      </div>
      {/* Larger screens: every step, by name. */}
      <ol className="hidden items-center gap-2 sm:flex">
        {STEPS.map((s, i) => {
          const done = i < step || (i <= furthest && i !== step);
          const reachable = i <= furthest;
          return (
            <li key={s.label} className="flex flex-1 items-center gap-2 last:flex-none">
              <button
                type="button"
                onClick={() => reachable && onJump(i)}
                disabled={!reachable}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md py-1 pr-1 text-sm transition-colors",
                  reachable ? "cursor-pointer" : "cursor-default",
                  i === step ? "font-medium text-gray-1000" : reachable ? "text-gray-1000 hover:text-gray-1000" : "text-gray-900",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                    i === step ? "border-gray-1000 bg-gray-1000 text-background-100" : done ? "border-gray-1000 text-gray-1000" : "border-gray-alpha-400 text-gray-900",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && <span aria-hidden className={cn("h-px flex-1", i < step ? "bg-gray-1000" : "bg-gray-alpha-400")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function Summary({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <dt className="w-16 shrink-0 text-gray-900">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-gray-1000">{children}</dd>
      <button type="button" onClick={onEdit} className="-my-1.5 flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[13px] text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000">
        <Pencil className="size-3.5" />
        Edit
      </button>
    </div>
  );
}

function Choice({ selected, onClick, icon, title, hint, compact, disabled }: { selected: boolean; onClick: () => void; icon?: React.ReactNode; title: string; hint: string; compact?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${title}: ${hint}`}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex w-full items-start gap-3 rounded-lg border text-left transition-colors",
        compact ? "p-3" : "p-3 sm:p-4",
        disabled
          ? "cursor-not-allowed border-dashed border-gray-alpha-400 bg-background-100 opacity-60"
          : selected
            ? "border-gray-1000 bg-gray-alpha-100 ring-1 ring-gray-1000"
            : "border-gray-alpha-400 bg-background-100 hover:border-gray-alpha-500 hover:bg-gray-alpha-100",
      )}
    >
      {icon && <span className={cn("mt-0.5 flex h-6 min-w-6 items-center justify-center [&_svg]:size-4", selected ? "text-gray-1000" : "text-gray-900")}>{icon}</span>}
      <span className="min-w-0 pr-6">
        <span className="block text-sm font-medium text-gray-1000">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-gray-900">{hint}</span>
      </span>
      {selected && (
        <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-gray-1000 text-background-100 sm:right-2.5 sm:top-2.5">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** One shared player for the voice samples: starting one stops the other, and leaving the page stops it. */
function useVoicePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<VoiceId | null>(null);
  useEffect(() => () => audio.current?.pause(), []);
  function toggle(id: VoiceId) {
    audio.current?.pause();
    if (playing === id) return setPlaying(null);
    const a = new Audio(`/voices/${id}.mp3`);
    a.onended = () => setPlaying(null);
    audio.current = a;
    setPlaying(id);
    a.play().catch(() => setPlaying(null));
  }
  return { playing, toggle };
}

function VoiceCard({ voice, selected, onSelect, playing, onPreview }: { voice: VoiceOption; selected: boolean; onSelect: () => void; playing: boolean; onPreview: () => void }) {
  return (
    <div
      className={cn(
        "relative flex items-center rounded-lg border transition-colors",
        selected ? "border-gray-1000 bg-gray-alpha-100 ring-1 ring-gray-1000" : "border-gray-alpha-400 bg-background-100 hover:border-gray-alpha-500 hover:bg-gray-alpha-100",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={`${voice.name}: ${voice.style}, ${voice.accent}, ${voice.gender}`}
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-col items-start p-3 pr-14 text-left"
      >
        <span className="text-sm font-medium text-gray-1000">{voice.name}</span>
        <span className="mt-0.5 text-xs leading-relaxed text-gray-900">
          {voice.style} · {voice.accent} · {voice.gender}
        </span>
      </button>
      <button
        type="button"
        onClick={onPreview}
        aria-label={playing ? `Stop ${voice.name}'s sample` : `Play ${voice.name}'s sample`}
        className="absolute right-2.5 flex size-10 items-center justify-center rounded-full border border-gray-alpha-400 bg-background-100 text-gray-1000 transition-colors hover:bg-gray-alpha-200 sm:size-9"
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
      </button>
    </div>
  );
}
