"use client";
import { ArrowRight, Check, GitBranch, Globe } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { creditsFor, LONG_VIDEO_SECONDS } from "@launchreel/core/pricing";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

const TONES = [
  { value: "", label: "Auto", hint: "We pick what fits your product" },
  { value: "polished", label: "Polished", hint: "Serious, elegant, restrained" },
  { value: "default", label: "Playful", hint: "Punchy, fun, clean" },
  { value: "yc-parody", label: "YC parody", hint: "A deadpan startup launch" },
  { value: "cinematic", label: "Cinematic", hint: "Trailer-scale, big claims" },
  { value: "app-store", label: "App Store", hint: "Clean feature cards" },
  { value: "deadpan", label: "Deadpan", hint: "Calm, dry, understated" },
  { value: "chaotic", label: "Chaotic", hint: "Fast, loud, all caps" },
];

const FORMATS = [
  { value: "landscape", label: "Landscape", ratio: "16:9", where: "Product Hunt, YouTube, your site", w: 32, h: 18 },
  { value: "vertical", label: "Vertical", ratio: "9:16", where: "TikTok, Reels, Shorts", w: 14, h: 24 },
  { value: "square", label: "Square", ratio: "1:1", where: "LinkedIn, X", w: 22, h: 22 },
];

// 15–30s: a teaser for social. 60–90s: a full launch video for your homepage.
const LENGTHS = [15, 20, 30, 60, 90];

export function NewVideoForm({ credits, initialUrl }: { credits: number; initialUrl: string }) {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"WEBSITE" | "GITHUB">(initialUrl.includes("github.com") ? "GITHUB" : "WEBSITE");
  const [url, setUrl] = useState(initialUrl);
  const [tone, setTone] = useState("");
  const [format, setFormat] = useState("landscape");
  const [duration, setDuration] = useState(20);
  const [notes, setNotes] = useState("");
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const cost = creditsFor("newVideo", duration);
  const enough = credits >= cost;

  function onUrl(value: string) {
    setUrl(value);
    if (error) setError(null);
    if (/github\.com\//i.test(value)) setSourceType("GITHUB");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let normalized = url.trim();
    if (normalized && !/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try {
      new URL(normalized);
    } catch {
      return setError({ message: sourceType === "GITHUB" ? "Enter a repo URL like https://github.com/owner/repo" : "Enter a website URL like https://yourproduct.com" });
    }
    if (!owner) return setError({ message: "Confirm that you own this product or may promote it." });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl: normalized, tone: tone || undefined, format, durationSec: duration, notes: notes.trim() || undefined, ownershipConfirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) return setError({ message: data.error ?? "Could not start the video", upgrade: data.upgrade });
      router.push(`/dashboard/videos/${data.id}`);
    } catch {
      setError({ message: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader title="Source" description="What should the video show? We read your site or code and use your real UI and copy." />
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Choice selected={sourceType === "WEBSITE"} onClick={() => setSourceType("WEBSITE")} icon={<Globe />} title="Website" hint="Any public URL" />
            <Choice selected={sourceType === "GITHUB"} onClick={() => setSourceType("GITHUB")} icon={<GitBranch />} title="GitHub repo" hint="Public or private repositories" />
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
            {sourceType === "GITHUB" && (
              <p className="mt-2 text-[13px] text-gray-900">
                Private repo? Save a read-only GitHub token in{" "}
                <Link href="/dashboard/settings" className="text-gray-1000 underline underline-offset-2">
                  Settings → Private repositories
                </Link>{" "}
                first. It&apos;s encrypted in your browser.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Style" description="Tone sets the pacing, typography and transitions." />
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TONES.map((t) => (
              <Choice key={t.value || "auto"} selected={tone === t.value} onClick={() => setTone(t.value)} title={t.label} hint={t.hint} compact />
            ))}
          </div>
          <div>
            <Label>Format</Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {FORMATS.map((f) => (
                <Choice
                  key={f.value}
                  selected={format === f.value}
                  onClick={() => setFormat(f.value)}
                  icon={<span className="block rounded-[3px] border-[1.5px] border-current" style={{ width: f.w, height: f.h }} />}
                  title={`${f.label} · ${f.ratio}`}
                  hint={f.where}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
            <div>
              <Label>Length</Label>
              <div className="inline-flex h-10 items-center gap-0.5 rounded-md border border-gray-alpha-400 bg-background-100 p-1" role="radiogroup" aria-label="Length">
                {LENGTHS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={duration === s}
                    onClick={() => setDuration(s)}
                    className={cn("h-full rounded px-4 text-sm tabular-nums transition-colors", duration === s ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000")}
                  >
                    {s}s
                  </button>
                ))}
              </div>
              <p className="mt-2 max-w-[300px] text-[13px] text-gray-900">
                {duration > LONG_VIDEO_SECONDS
                  ? "Full launch video for your homepage: hook, problem, features and a call to action. Can take up to an hour."
                  : "A teaser for social feeds. Ready in about 10–20 minutes."}
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Direction (optional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="Focus on the new AI search. Make it feel like a keynote." />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" aria-label="I own this product or I'm authorized to promote it" checked={owner} onChange={(e) => setOwner(e.target.checked)} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
            <span className="text-gray-1000">
              I own this product or I&apos;m authorized to promote it.
              <span className="block text-[13px] text-gray-900">Videos show your product&apos;s UI and copy only: no real people, no cloned voices.</span>
            </span>
          </label>
          <div className="flex shrink-0 items-center gap-3">
            <span className={cn("text-[13px] tabular-nums", enough ? "text-gray-900" : "text-amber-900")}>
              {cost} credits · you have {credits}
            </span>
            {enough ? (
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
        </CardContent>
        {error && (
          <div className="border-t border-gray-alpha-400 px-5 py-3 text-[13px] text-red-900" role="alert">
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
      </Card>
    </form>
  );
}

function Choice({ selected, onClick, icon, title, hint, compact }: { selected: boolean; onClick: () => void; icon?: React.ReactNode; title: string; hint: string; compact?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${title}: ${hint}`}
      onClick={onClick}
      className={cn(
        "relative flex w-full items-start gap-3 rounded-lg border text-left transition-colors",
        compact ? "p-3" : "p-4",
        selected ? "border-blue-700 bg-blue-100 ring-1 ring-blue-700" : "border-gray-alpha-400 bg-background-100 hover:border-gray-alpha-500 hover:bg-gray-alpha-100",
      )}
    >
      {icon && <span className={cn("mt-0.5 flex h-6 min-w-6 items-center justify-center [&_svg]:size-4", selected ? "text-blue-900" : "text-gray-900")}>{icon}</span>}
      <span className="min-w-0 pr-5">
        <span className={cn("block text-sm font-medium", selected ? "text-blue-900" : "text-gray-1000")}>{title}</span>
        <span className={cn("mt-0.5 block text-xs leading-relaxed", selected ? "text-blue-900/80" : "text-gray-900")}>{hint}</span>
      </span>
      {selected && (
        <span className="absolute right-2.5 top-2.5 flex size-4 items-center justify-center rounded-full bg-blue-700 text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
