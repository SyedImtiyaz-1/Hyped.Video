import { ArrowRight, AudioLines, Captions, Check, Clapperboard, FileText, Gift, Link2, Megaphone, MonitorSmartphone, Music, Share2, Sparkles } from "lucide-react";
import { PACKS, QUALITY_CREDIT_MULTIPLIER, TEMPLATES, TRIAL_CREDITS, perCredit, templateById, type Template } from "@launchreel/core";
import { CreditTable } from "@/components/credit-table";
import { PackCards, PriceNote, cheapestPack } from "@/components/pricing/pack-cards";
import { TemplateCard } from "@/components/templates/template-gallery";
import { ButtonLink } from "@/components/ui/button";
import { money } from "@/lib/format";
import { visitorCurrency } from "@/lib/region";
import { studioAvailable } from "@/lib/studio";

const STEPS = [
  { icon: Link2, title: "Paste a URL or repo", body: "Your website, or a GitHub repo, public or private. We read your real copy, colors, fonts and UI." },
  { icon: Clapperboard, title: "We plan, build and render", body: "An agent writes the storyboard, animates your product, scores it and renders an MP4." },
  { icon: Share2, title: "Share it everywhere", body: "Download the video with share copy. Ask for changes in plain English." },
];

const SPECS = ["16:9 · 9:16 · 1:1", "15–90 seconds", "Music and AI voiceover", "Captions and share copy"];

// Shown on the homepage; the rest are one click away on /templates.
const FEATURED_TEMPLATES = ["launch-day", "three-features", "problem-solution"].map((id) => templateById(id)).filter((t): t is Template => Boolean(t));

// What every video comes with, whichever pack paid for it.
const INCLUDED = [
  { icon: FileText, label: "Script and storyboard, written for you" },
  { icon: Sparkles, label: "Animated scenes from your real UI" },
  { icon: AudioLines, label: "AI voiceover, 6 voices" },
  { icon: Captions, label: "Word-by-word captions and SRT file" },
  { icon: Music, label: "Licensed music and sound effects" },
  { icon: Megaphone, label: "Share copy for X, LinkedIn and Product Hunt" },
  { icon: MonitorSmartphone, label: "16:9, 9:16 or 1:1" },
  { icon: Check, label: "Yours to use commercially, ads included" },
];

const STUDIO_Q = "What's the difference between Standard and Studio?";
const FAQ = [
  {
    q: "What do I get?",
    a: "An MP4 with music, motion and on-screen copy: a 15–30 second teaser for social, or a 60–90 second launch video for your homepage. Plus a poster image and ready-to-post share copy, in landscape, vertical or square.",
  },
  { q: "How long does it take?", a: "Usually 10–20 minutes for a teaser, up to an hour for a 90-second video. You can close the tab; the dashboard updates when it's ready." },
  { q: "Is it made from my actual product?", a: "Yes. We read your site or code and reuse your real UI, copy, colors and fonts. No stock footage, no avatars." },
  { q: "Can I use a private repo?", a: "Yes. Paste a read-only GitHub token under the repo link. It's encrypted in your browser, used only to download the code, and never seen by the AI agent." },
  {
    q: STUDIO_Q,
    a: `Both make a finished video with music, motion and share copy from your real product. Standard is our lowest price, great for social posts, updates and demos. Studio is our most advanced director, with richer storytelling and motion design, for your big launch; it uses ${QUALITY_CREDIT_MULTIPLIER.studio}× the credits.`,
  },
  {
    q: "Can it add a voiceover and captions?",
    a: "Yes. Pick one of six AI voices (warm, energetic or calm; American or British) and hear each one first. Hyped writes the narration, times the video to it, burns in word-by-word captions and gives you an SRT file. Voiceover costs no extra credits. The voice is AI-generated, so let your viewers know.",
  },
  { q: "Do I need a subscription?", a: `No. Buy a pack when you need one; credits never expire. You start with ${TRIAL_CREDITS} free credits.` },
  { q: "What are bonus credits?", a: `Extra credits we add to the bigger packs: ${PACKS.CREATOR.bonus} with Creator and ${PACKS.PRO.bonus} with Pro. They work exactly like the others and never expire.` },
  { q: "Why are prices different in India?", a: "In India, Hyped is priced in rupees for local budgets, with GST included, and you can pay by UPI. Dodo Payments sets the price from your billing country at checkout." },
  { q: "What if I don't like it?", a: "Ask for a change in plain English, for half the credits of a new video (rounded up). If a render fails, your credits come back automatically." },
  { q: "Who handles payments and tax?", a: "Dodo Payments is our merchant of record. It handles checkout, invoices and sales tax or VAT worldwide." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ currency?: string }> }) {
  const [currency, studio] = await Promise.all([visitorCurrency((await searchParams).currency), studioAvailable()]);
  const faq = studio ? FAQ : FAQ.map((f) => (f.q === STUDIO_Q ? { ...f, a: `${f.a} Studio is coming soon.` } : f));
  const from = money(perCredit(cheapestPack(currency), currency), currency);
  return (
    <main>
      <section className="relative overflow-hidden border-b border-gray-alpha-400">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--ds-gray-alpha-200)_1px,transparent_1px),linear-gradient(to_bottom,var(--ds-gray-alpha-200)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
        />
        <div className="relative mx-auto max-w-[1200px] px-4 pb-20 pt-20 text-center md:px-8 md:pb-28 md:pt-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-gray-alpha-400 bg-background-100 px-3 py-1 text-[13px] font-medium">
            <span className="size-1.5 rounded-full bg-brand shadow-[0_0_8px_var(--ds-brand)]" />
            Now in beta
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-[-0.05em] md:text-[72px]">
            Launch videos made from your <span className="text-brand">real product.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-900 md:text-xl">
            Paste your website or GitHub repo. In about 15 minutes you get a polished launch video with music, motion, an optional AI voiceover and share copy, built from your actual UI instead of stock footage.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/dashboard" variant="primary" size="lg">
              Make your first video <ArrowRight />
            </ButtonLink>
            <ButtonLink href="#pricing" size="lg">
              See pricing
            </ButtonLink>
          </div>
          <p className="mt-4 text-[13px] text-gray-900">5 free credits. No card required.</p>

          <div className="relative mx-auto mt-16 max-w-4xl">
            <div aria-hidden className="pointer-events-none absolute -inset-x-8 -inset-y-6 rounded-[40px] bg-brand/15 blur-[90px]" />
            <div className="relative overflow-hidden rounded-2xl border border-gray-alpha-400 bg-background-200 shadow-[0_24px_80px_-24px_rgb(0_0_0/0.9)]">
              <video
                src="/examples/bidthe1-launch.mp4"
                poster="/examples/bidthe1-launch.jpg"
                autoPlay
                muted
                loop
                playsInline
                controls
                preload="metadata"
                aria-label="Example launch video: bidthe1.com"
                className="block aspect-video w-full"
              />
            </div>
            <p className="mt-4 text-[13px] text-gray-900">
              The launch film for <span className="text-gray-1000">bidthe1.com</span>, with voiceover and captions. Unmute to hear it.
            </p>
          </div>

          <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-900">
            {SPECS.map((s) => (
              <li key={s} className="flex items-center gap-2">
                <Check className="size-4 text-brand" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1200px] px-4 py-20 md:px-8">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">From link to launch video</h2>
        <p className="mt-3 max-w-xl text-gray-900">Three steps. No editor, no timeline, no stock footage.</p>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-gray-alpha-400 bg-gray-alpha-400 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="bg-background-100 p-6">
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-md border border-gray-alpha-400 text-gray-1000">
                  <Icon className="size-4" />
                </span>
                <span className="font-mono text-xs text-gray-900">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-900">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="templates" className="mx-auto max-w-[1200px] px-4 pb-20 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Start from a template</h2>
            <p className="mt-3 max-w-xl text-gray-900">Proven recipes for launches, updates and ads. Pick one, paste your link, and every step is filled in for you.</p>
          </div>
          <ButtonLink href="/templates">
            All {TEMPLATES.length} templates <ArrowRight />
          </ButtonLink>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {FEATURED_TEMPLATES.map((t) => (
            <TemplateCard key={t.id} template={t} href={`/dashboard/new?template=${t.id}`} />
          ))}
        </div>
      </section>

      <section id="pricing" className="border-y border-gray-alpha-400 bg-background-200">
        <div className="mx-auto max-w-[1200px] px-4 py-20 md:px-8">
          <p className="text-sm font-medium text-brand">Pricing</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Launch videos from {from} each</h2>
          <p className="mt-3 max-w-2xl text-gray-900">Pay once for a pack of credits. No subscription, credits never expire, and if a render fails, its credits come back automatically.</p>

          <div className="mt-10 flex flex-col gap-4 rounded-xl border border-gray-alpha-400 bg-background-100 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand text-brand-ink">
                <Gift className="size-4" />
              </span>
              <div>
                <p className="font-semibold">Start free with {TRIAL_CREDITS} credits</p>
                <p className="mt-0.5 text-sm text-gray-900">{TRIAL_CREDITS > PACKS.STARTER.credits ? "More than the Starter pack, and no card needed." : "No card needed."} Free videos carry a small watermark.</p>
              </div>
            </div>
            <ButtonLink href="/dashboard" className="shrink-0">
              Start free
            </ButtonLink>
          </div>

          <div className="mt-4">
            <PackCards currency={currency} />
          </div>
          <PriceNote currency={currency} className="mt-4" />
          <p className="mt-6 max-w-3xl text-sm text-gray-900">
            For comparison, a 30–60 second explainer from a freelancer on Fiverr usually costs $170–$350{currency === "inr" ? " (about ₹16,000–₹34,000)" : ""} and takes 5–7 days, according to{" "}
            <a href="https://www.fiverr.com/resources/guides/costs/content-creator" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-gray-1000">
              Fiverr&apos;s own cost guide
            </a>
            . A Hyped video starts at {from} and is usually ready in 10–20 minutes.
          </p>

          <div className="mt-10 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-xl border border-gray-alpha-400 bg-background-100 p-6">
              <h3 className="text-base font-semibold">Every video includes</h3>
              <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {INCLUDED.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-gray-alpha-400 bg-background-100 p-6">
              <h3 className="text-base font-semibold">How credits work</h3>
              <CreditTable className="mt-2" studioSoon={!studio} />
              <p className="mt-3 text-[13px] text-gray-900">
                1 credit makes one Standard video up to 30 seconds. {studio ? "Studio is our most advanced director, for your big launch." : "Studio, our most advanced director, is coming soon."} A revision costs half,
                rounded up.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-[880px] px-4 py-20 md:px-8">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Questions</h2>
        <div className="mt-8 divide-y divide-gray-alpha-400 border-y border-gray-alpha-400">
          {faq.map(({ q, a }) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span className="text-gray-900 transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-gray-900">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-gray-alpha-400">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-full size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-[110px]" />
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-4 py-24 text-center md:px-8">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-5xl">Your launch deserves a video.</h2>
          <p className="max-w-md text-gray-900">Paste a link. Get a launch video in minutes. The first one is on us.</p>
          <ButtonLink href="/dashboard" variant="primary" size="lg">
            Make your first video <ArrowRight />
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
