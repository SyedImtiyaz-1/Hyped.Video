"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { TRIAL_CREDITS } from "@launchreel/core/pricing";
import { PromptBox } from "@/components/create/prompt-box";
import { serif } from "@/components/create/serif";
import { cn } from "@/lib/cn";

// The headline's last words, one at a time.
const WORDS = ["real product.", "website.", "GitHub repo.", "latest release.", "own clips."];

/** The homepage's hero: a headline whose last words rotate, the prompt box (components/create/prompt-box.tsx), the terms. */
export function HeroPrompt() {
  const [word, setWord] = useState(0);

  // The headline's words rotate, unless the visitor asked for less motion.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-3xl text-center">
      <h1 className="mx-auto min-h-[2.1em] text-[44px] font-semibold leading-[1.05] tracking-[-0.05em] md:text-[76px]">
        Videos made from your{" "}
        <span key={word} className={cn(serif.className, "inline-block pr-1 font-normal tracking-[-0.02em] text-brand motion-safe:animate-word-in")}>
          {WORDS[word]}
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
