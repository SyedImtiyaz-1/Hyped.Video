import { ArrowRight, Check, Clapperboard, Link2, Share2 } from "lucide-react";
import { CREDIT_COST, PACK_1, PLANS, type PlanId } from "@launchreel/core";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

const STEPS = [
  { icon: Link2, title: "Paste a URL or repo", body: "Your website or a public GitHub repo. We read your real copy, colors, fonts and UI." },
  { icon: Clapperboard, title: "We plan, build and render", body: "An agent writes the storyboard, animates your product, scores it and renders an MP4." },
  { icon: Share2, title: "Share it everywhere", body: "Download the video with share copy. Ask for changes in plain English." },
];

const FEATURES: Record<PlanId, { text: string; soon?: boolean }[]> = {
  FREE: [{ text: "1 video to try it" }, { text: "Watermarked" }, { text: "All tones and formats" }],
  STARTER: [{ text: "No watermark" }, { text: "All tones and formats" }, { text: "Revisions for 1 credit" }],
  PRO: [{ text: "Priority rendering" }, { text: "Revisions for 1 credit" }, { text: "Brand kit", soon: true }, { text: "GitHub release videos", soon: true }],
  AGENCY: [{ text: "Top-priority rendering" }, { text: "White-label pages", soon: true }, { text: "Client workspaces", soon: true }, { text: "API access", soon: true }],
};

const FAQ = [
  { q: "What do I get?", a: "A 15–30 second MP4 with music, motion and on-screen copy, a poster image, and ready-to-post share copy. Landscape, vertical or square." },
  { q: "How long does it take?", a: "Usually 10–20 minutes. You can close the tab; the dashboard updates when your video is ready." },
  { q: "Is it made from my actual product?", a: "Yes. We read your site or code and reuse your real UI, copy, colors and fonts. No stock footage, no avatars." },
  { q: "What if I don't like it?", a: "Ask for a change in plain English (1 credit). If a render fails, your credits come back automatically." },
  { q: "Who handles payments and tax?", a: "Dodo Payments is our merchant of record. It handles checkout, invoices and sales tax or VAT worldwide." },
];

export default function Home() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-gray-alpha-400">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--ds-gray-alpha-200)_1px,transparent_1px),linear-gradient(to_bottom,var(--ds-gray-alpha-200)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
        />
        <div className="relative mx-auto max-w-[1200px] px-4 pb-16 pt-20 text-center md:px-8 md:pb-24 md:pt-28">
          <Badge tone="blue" size="md">Now in beta</Badge>
          <h1 className="mx-auto mt-6 max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-[-0.05em] md:text-[72px]">{BRAND.tagline}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-900 md:text-xl">
            Paste your website or GitHub repo. In about 15 minutes you get a polished launch video with music, motion and share copy, built from your actual UI instead of stock footage.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/dashboard" variant="primary" size="lg">
              Make your first video <ArrowRight />
            </ButtonLink>
            <ButtonLink href="#pricing" size="lg">
              See pricing
            </ButtonLink>
          </div>
          <p className="mt-4 text-[13px] text-gray-900">First video free. No card required.</p>
          <div className="mx-auto mt-14 max-w-3xl text-left">
            <ProductPreview />
          </div>
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

      <section id="pricing" className="border-y border-gray-alpha-400 bg-background-200">
        <div className="mx-auto max-w-[1200px] px-4 py-20 md:px-8">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Pricing</h2>
          <p className="mt-3 max-w-xl text-gray-900">Less than a Fiverr gig per video. Failed renders are always refunded.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(PLANS) as PlanId[]).map((id) => {
              const plan = PLANS[id];
              const featured = id === "PRO";
              const videos = plan.creditsPerMonth / CREDIT_COST.newVideo;
              return (
                <div key={id} className={cn("flex flex-col rounded-xl border bg-background-100 p-6", featured ? "border-gray-1000 ring-1 ring-gray-1000" : "border-gray-alpha-400")}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                    {featured && <Badge tone="inverted">Popular</Badge>}
                  </div>
                  <p className="mt-4">
                    <span className="text-4xl font-semibold tracking-[-0.04em]">${plan.priceUsd}</span>
                    {plan.priceUsd > 0 && <span className="text-sm text-gray-900">/month</span>}
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{id === "FREE" ? "One video on us" : `${videos} videos a month`}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    {FEATURES[id].map((f) => (
                      <li key={f.text} className="flex items-center gap-2 whitespace-nowrap">
                        <Check className="size-4 shrink-0 text-gray-1000" />
                        <span className={f.soon ? "text-gray-900" : undefined}>{f.text}</span>
                        {f.soon && <Badge>Soon</Badge>}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink href={id === "FREE" ? "/dashboard" : `/dashboard/billing?plan=${id}`} variant={featured ? "primary" : "secondary"} className="mt-6 w-full">
                    {id === "FREE" ? "Start free" : `Choose ${plan.name}`}
                  </ButtonLink>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-gray-900">
            Just need one? A single video is ${PACK_1.priceUsd}, no subscription.{" "}
            <a href="/dashboard/billing" className="font-medium text-gray-1000 underline underline-offset-4">Buy one video</a>
          </p>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-[880px] px-4 py-20 md:px-8">
        <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Questions</h2>
        <div className="mt-8 divide-y divide-gray-alpha-400 border-y border-gray-alpha-400">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <span className="text-gray-900 transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-gray-900">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t border-gray-alpha-400">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-4 py-20 text-center md:px-8">
          <h2 className="text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Your launch deserves a video.</h2>
          <ButtonLink href="/dashboard" variant="primary" size="lg">
            Make your first video <ArrowRight />
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
