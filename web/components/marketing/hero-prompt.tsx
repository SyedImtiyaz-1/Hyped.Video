"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TRIAL_CREDITS } from "@launchreel/core/pricing";
import { PromptBox } from "@/components/create/prompt-box";
import { serifUpright } from "@/components/create/serif";
import { cn } from "@/lib/cn";

// The headline, one video and its source at a time: everything Hyped makes, and what it makes it from.
const LINES = [
  { what: "a launch video", from: "your website" },
  { what: "a product demo", from: "your GitHub repo" },
  { what: "a reel", from: "the clip you recorded" },
  { what: "a feature video", from: "your latest release" },
  { what: "an ad", from: "your landing page" },
];

/** The homepage's hero: a serif headline that cycles through what Hyped makes, the prompt box (prompt-box.tsx), the terms. */
export function HeroPrompt() {
  const [line, setLine] = useState(0);

  // The headline cycles, unless the visitor asked for less motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setLine((l) => (l + 1) % LINES.length), 2800);
    return () => window.clearInterval(timer);
  }, []);

  const { what, from } = LINES[line];
  return (
    <div className="relative mx-auto w-full max-w-3xl text-center">
      <h1 className={cn(serifUpright.className, "mx-auto min-h-[2.2em] text-[44px] leading-[1.05] tracking-[-0.02em] md:text-[72px]")}>
        <span key={line} className="inline-block motion-safe:animate-word-in">
          Make <span className="text-brand">{what}</span>
          <br />
          from {from}
        </span>
      </h1>
      <PromptBox cta="Make my free video" className="mt-10" />
      <p className="mt-5 text-[13px] text-gray-900">
        {TRIAL_CREDITS} free credits, no card. Made from your real UI, copy and fonts, never stock footage.{" "}
        <Link href="/recipes" className="text-gray-1000 underline-offset-2 hover:underline">
          Browse recipes
        </Link>
      </p>
    </div>
  );
}
