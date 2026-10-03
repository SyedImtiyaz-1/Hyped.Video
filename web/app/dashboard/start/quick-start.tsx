"use client";
import { ArrowRight, Globe, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hostOf, plural } from "@/lib/format";
import { normalizeSourceUrl } from "@/lib/source-url";

/**
 * One step to a video: the URL, the ownership promise Dodo requires (customers may only make videos of products they
 * own or may promote), and go. The API fills in the rest: a 20-second landscape launch video with upbeat music.
 */
export function QuickStart({ initialUrl, credits }: { initialUrl: string; credits: number }) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [owner, setOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const normalized = normalizeSourceUrl(url);
  const customize = `/dashboard/new${normalized ? `?url=${encodeURIComponent(normalized)}` : ""}`;

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!normalized) return setError({ message: "Enter your website or GitHub repo, like myapp.com or github.com/you/app." });
    if (!owner) return setError({ message: "Tick the box to confirm it's your product (or you may promote it)." });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceUrl: normalized, ownershipConfirmed: true }) });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; upgrade?: boolean };
      if (!res.ok || !data.id) return setError({ message: data.error ?? "The video couldn't start. Try again in a moment.", upgrade: data.upgrade });
      router.push(`/dashboard/videos/${data.id}`);
    } catch {
      setError({ message: "You're offline. Try again in a moment." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6 md:p-8">
      <form onSubmit={start} className="space-y-5">
        <div>
          <label htmlFor="start-url" className="mb-1.5 block text-sm font-medium text-gray-1000">
            Your website or GitHub repo
          </label>
          <Input id="start-url" value={url} onChange={(e) => (setUrl(e.target.value), setError(null))} placeholder="https://yourproduct.com" prefix={<Globe />} autoFocus={!initialUrl} />
        </div>
        <div className="rounded-lg border border-gray-alpha-400 bg-background-200 p-4 text-sm text-gray-900">
          <p className="font-medium text-gray-1000">{normalized ? `A 20-second launch video of ${hostOf(normalized)}` : "A 20-second launch video of your product"}</p>
          <p className="mt-1">Made from your real product, with motion and music, ready in about 15 minutes. It uses 1 of your {plural(credits, "credit")}.</p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-1000">
          <input type="checkbox" checked={owner} onChange={(e) => (setOwner(e.target.checked), setError(null))} className="mt-0.5 size-4 accent-[var(--ds-gray-1000)]" />
          <span>This is my product, or I have permission to promote it.</span>
        </label>
        {error && (
          <p className="text-[13px] text-red-900" role="alert">
            {error.message}{" "}
            {error.upgrade && (
              <a href="/dashboard/billing" className="font-medium underline underline-offset-2">
                Get credits
              </a>
            )}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" size="lg" disabled={busy || credits < 1}>
            {busy ? <LoaderCircle className="animate-spin" /> : null}
            {credits < 1 ? "Out of credits" : "Make my video"}
            {!busy && <ArrowRight />}
          </Button>
          {credits < 1 ? (
            <ButtonLink href="/dashboard/billing">Get credits</ButtonLink>
          ) : (
            <ButtonLink href={customize} variant="tertiary">
              <SlidersHorizontal />
              Customize it first
            </ButtonLink>
          )}
        </div>
        <p className="text-xs text-gray-900">Customize to pick the length, format, a voiceover, a template, or tell the story in your words.</p>
      </form>
    </Card>
  );
}
