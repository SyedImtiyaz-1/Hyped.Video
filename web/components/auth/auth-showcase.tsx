"use client";
import { ArrowUp, ChevronDown, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { posterSrc, SHOWCASE } from "@/lib/showcase";

// What the prompt box writes, one ask at a time: the kinds of video Hyped makes, in a customer's words.
const PROMPTS = [
  "Make a 30-second launch video for hyped.video",
  "Turn my recording into a reel with captions",
  "A feature video from our latest GitHub release",
  "Cut the pauses and add music under my clip",
];

const CHIPS = ["Make a launch video", "Edit my clip", "Caption a reel"];

// The fan of videos behind the box: which poster, and its size (the middle one tallest).
const FAN: { id: string; size: string }[] = [
  { id: "cmus8frem0009oufwfpyjq0nr", size: "h-[150px] w-[92px]" },
  { id: "cmus8fre70003oufwod3jw8or", size: "h-[176px] w-[120px]" },
  { id: "cmuo53uiq000louici7g2ta4h", size: "h-[206px] w-[150px]" },
  { id: "cmus8freq000boufw3slpyvda", size: "h-[176px] w-[120px]" },
  { id: "cmus8frei0007oufwdk6g8a85", size: "h-[150px] w-[92px]" },
];

/** Types each prompt, holds it, clears it, then the next; the first prompt stays put with reduced motion. */
function useTyping() {
  const [text, setText] = useState(PROMPTS[0]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let prompt = 0;
    let chars = 0;
    let deleting = false;
    let timer = 0;
    const step = () => {
      const full = PROMPTS[prompt];
      if (!deleting) {
        chars += 1;
        setText(full.slice(0, chars));
        if (chars === full.length) {
          deleting = true;
          timer = window.setTimeout(step, 2400);
          return;
        }
        timer = window.setTimeout(step, 45);
      } else {
        chars -= 1;
        setText(full.slice(0, chars));
        if (chars === 0) {
          deleting = false;
          prompt = (prompt + 1) % PROMPTS.length;
          timer = window.setTimeout(step, 400);
          return;
        }
        timer = window.setTimeout(step, 18);
      }
    };
    setText("");
    timer = window.setTimeout(step, 600);
    return () => window.clearTimeout(timer);
  }, []);
  return text;
}

/** The auth pages' right-hand panel (wide screens only): videos Hyped made, and the prompt box writing an ask. */
export function AuthShowcase() {
  const text = useTyping();
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden rounded-[28px] border border-white/[0.06] bg-[#0c0c0f] lg:flex lg:items-center lg:justify-center"
    >
      {/* Light from above, Hyped's lime glow from below, and fine lines rising out of it. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_35%_0%,rgb(70_80_120/0.28),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[radial-gradient(ellipse_45%_55%_at_50%_100%,rgb(200_241_53/0.16),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.05)_0_1px,transparent_1px_16px)] [mask-image:linear-gradient(to_top,black,transparent)]" />

      <div className="relative w-[min(560px,88%)]">
        <div className="flex items-end justify-center gap-2">
          {FAN.map(({ id, size }) => {
            const video = SHOWCASE.find((v) => v.id === id);
            if (!video) return null;
            return (
              <div key={id} className={cn("shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#18181b]", size)}>
                <img src={posterSrc(video)} alt="" className="size-full object-cover" loading="lazy" />
              </div>
            );
          })}
        </div>

        <div className="relative -mt-12 rounded-2xl border border-white/10 bg-[#1b1b1e]/95 p-4 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] backdrop-blur">
          <p className="min-h-[56px] text-[15px] font-medium leading-snug text-white">
            {text}
            <span className="ml-px inline-block h-[1.05em] w-px translate-y-[3px] bg-white/70 motion-safe:animate-pulse" />
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.08] text-white/80">
              <Plus className="size-4" />
            </span>
            <span className="flex items-center gap-1 text-[13px] font-medium text-white/90">
              Auto <ChevronDown className="size-3.5 text-white/60" />
            </span>
            <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-white/[0.06] text-white/50">
              <Sparkles className="size-3.5" />
            </span>
            <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.12] text-white/70">
              <ArrowUp className="size-4" />
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {CHIPS.map((chip, i) => (
            <span
              key={chip}
              className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", i === 0 ? "bg-white/[0.1] text-white" : "bg-white/[0.05] text-white/55")}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
