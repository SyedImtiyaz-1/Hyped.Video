import { AudioLines, Captions, Music, Ratio, Share2, Sparkles } from "lucide-react";
import { CAPTION_ANIMATIONS, CAPTION_FONTS, REEL_STYLES } from "@launchreel/core/captions";
import { VOICES } from "@launchreel/core/voices";
import { REEL_STYLE_INFO } from "@/components/reels/labels";
import { cn } from "@/lib/cn";

// The caption the phone shows, lit up one word at a time (--animate-caption-word, a quarter of the cycle each).
const CAPTION = ["Most", "people", "never", "launch"];
const SHOWN_STYLES = 9;
// Bar heights for the voiceover's waveform, as fractions of its height: a fixed shape, so the server render is stable.
const WAVE = [0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.95, 0.65, 0.45, 0.8, 1, 0.55, 0.75, 0.9, 0.5, 0.7, 0.4, 0.85, 0.6, 0.95, 0.5, 0.7];

/**
 * "What every video gets", as cards that show it: captions on a phone, an Ask AI exchange, the three shapes, a voiceover
 * waveform, a music and sound timeline, and share posts. Drawn with CSS only, no video loads; still with reduced motion.
 */
export function FeatureBento() {
  const animations = CAPTION_ANIMATIONS.filter((a) => a !== "none").length;
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <Card className="md:col-span-4 md:row-span-2">
        <div className="grid h-full gap-8 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <Heading icon={Captions} eyebrow="Reels">
              Captions people stop scrolling for
            </Heading>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-900">
              {REEL_STYLES.length} caption styles, {CAPTION_FONTS.length} fonts and {animations} word-by-word animations. Upload a clip you recorded and Hyped cuts the pauses, then adds captions, zooms,
              emojis, B-roll and music. Every cut can be put back.
            </p>
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {REEL_STYLES.slice(0, SHOWN_STYLES).map((id) => (
                <li key={id} title={REEL_STYLE_INFO[id].hint} className="rounded-full border border-gray-alpha-400 px-2.5 py-1 text-xs text-gray-1000">
                  {REEL_STYLE_INFO[id].label}
                </li>
              ))}
              <li className="rounded-full px-2.5 py-1 text-xs text-gray-900">+{REEL_STYLES.length - SHOWN_STYLES} more</li>
            </ul>
          </div>
          <div className="relative mx-auto aspect-[9/16] w-44 overflow-hidden rounded-[28px] border-4 border-gray-300 bg-black shadow-[0_30px_80px_-30px_rgb(200_241_53/0.45)] md:w-52">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/reels/sample-frame.jpg" alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
            <p className="absolute inset-x-3 top-[58%] flex flex-wrap justify-center gap-x-1.5 text-center text-[22px] font-black uppercase leading-none tracking-[-0.02em] text-white [text-shadow:0_2px_0_#000,0_0_14px_rgb(0_0_0/0.7)] md:text-[26px]">
              {CAPTION.map((word, i) => (
                <span key={word} className="inline-block motion-safe:animate-caption-word" style={{ animationDelay: `${i * 0.8}s` }}>
                  {word}
                </span>
              ))}
            </p>
          </div>
        </div>
      </Card>

      <Card className="md:col-span-2">
        <Heading icon={Sparkles}>Change anything in plain English</Heading>
        <p className="mt-2 text-sm leading-relaxed text-gray-900">In the editor, Ask AI makes any change the editor can: checked first, undoable, and free.</p>
        <div className="mt-5 space-y-2 text-[13px]">
          <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-gray-1000 px-3 py-2 text-background-100">Make the hook punchier and the captions bigger</p>
          <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md border border-gray-alpha-400 bg-gray-alpha-100 px-3 py-2">
            <p className="flex items-center gap-1.5 text-gray-1000">
              <Sparkles className="size-3.5 text-brand" /> Done: a new hook, and captions set to large.
            </p>
            <p className="mt-1 text-xs text-gray-900">2 changes · Undo</p>
          </div>
        </div>
      </Card>

      <Card className="md:col-span-2">
        <Heading icon={Ratio}>Every shape, one click</Heading>
        <p className="mt-2 text-sm leading-relaxed text-gray-900">Landscape for your homepage, vertical for Reels and TikTok, square for the feed.</p>
        <div className="mt-6 flex items-end justify-center gap-4">
          {(
            [
              ["16:9", "h-16 aspect-video"],
              ["9:16", "h-24 aspect-[9/16]"],
              ["1:1", "h-16 aspect-square"],
            ] as const
          ).map(([label, shape]) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className={cn("rounded-md border border-gray-alpha-500 bg-[linear-gradient(135deg,rgb(200_241_53/0.18),transparent_60%)]", shape)} />
              <span className="font-mono text-xs text-gray-900">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="md:col-span-2">
        <Heading icon={AudioLines}>{VOICES.length} AI voices</Heading>
        <p className="mt-2 text-sm leading-relaxed text-gray-900">Warm, energetic or calm; American or British. Hyped writes the narration and times the video to it.</p>
        <div aria-hidden className="mt-6 flex h-12 items-center justify-center gap-1">
          {WAVE.map((h, i) => (
            <span key={i} className="w-1 origin-center rounded-full bg-brand/85 motion-safe:animate-wave" style={{ height: `${h * 100}%`, animationDelay: `${(i % 6) * 0.14}s` }} />
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-gray-900">{VOICES.map((v) => v.name).join(" · ")}</p>
      </Card>

      <Card className="md:col-span-2">
        <Heading icon={Music}>Music and sound, licensed</Heading>
        <p className="mt-2 text-sm leading-relaxed text-gray-900">A music bed under the whole video and sound effects on the cuts. Yours to use commercially, ads included.</p>
        <div aria-hidden className="mt-6 space-y-1.5 font-mono text-[11px] text-gray-900">
          <Track label="Video">
            {[18, 26, 14, 22, 20].map((w, i) => (
              <span key={i} className="h-full rounded-sm bg-gray-alpha-400" style={{ width: `${w}%` }} />
            ))}
          </Track>
          <Track label="Music">
            <span className="h-full w-full rounded-sm bg-[repeating-linear-gradient(90deg,rgb(200_241_53/0.55)_0_2px,transparent_2px_5px)]" />
          </Track>
          <Track label="SFX">
            {[17, 43, 57, 79].map((left) => (
              <span key={left} className="absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-brand" style={{ left: `${left}%` }} />
            ))}
          </Track>
        </div>
      </Card>

      <Card className="md:col-span-2">
        <Heading icon={Share2}>Share copy, written for you</Heading>
        <p className="mt-2 text-sm leading-relaxed text-gray-900">Every video comes with posts for X, LinkedIn and Product Hunt, ready to paste.</p>
        <div aria-hidden className="mt-5 space-y-2">
          {["X", "LinkedIn", "Product Hunt"].map((site, i) => (
            <div key={site} className="flex items-center gap-3 rounded-lg border border-gray-alpha-400 bg-gray-alpha-100 px-3 py-2">
              <span className="w-20 shrink-0 text-xs font-medium text-gray-1000">{site}</span>
              <span className="h-1.5 flex-1 rounded-full bg-gray-alpha-400" style={{ maxWidth: `${88 - i * 14}%` }} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-gray-alpha-400 bg-background-100 bg-[radial-gradient(120%_70%_at_0%_0%,rgb(200_241_53/0.06),transparent_60%)] p-6", className)}>
      {children}
    </div>
  );
}

function Heading({ icon: Icon, eyebrow, children }: { icon: React.ComponentType<{ className?: string }>; eyebrow?: string; children: React.ReactNode }) {
  return (
    <>
      {eyebrow && <p className="mb-3 text-xs font-medium uppercase tracking-[0.12em] text-brand">{eyebrow}</p>}
      <h3 className="flex items-center gap-2.5 text-base font-semibold">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-gray-alpha-400 text-gray-1000">
          <Icon className="size-4" />
        </span>
        {children}
      </h3>
    </>
  );
}

function Track({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0">{label}</span>
      <div className="relative flex h-4 flex-1 gap-1">{children}</div>
    </div>
  );
}
