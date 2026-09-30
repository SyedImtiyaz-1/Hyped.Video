import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

// The Hyped mark: a lime launch-day burst with a play button, on a near-black tile.
// Same artwork as app/icon.svg and public/brand/hyped-icon.svg.
export const BURST_POINTS =
  "60,20 68.7,27.6 80,25.4 83.7,36.3 94.6,40 92.4,51.3 100,60 92.4,68.7 94.6,80 83.7,83.7 80,94.6 68.7,92.4 60,100 51.3,92.4 40,94.6 36.3,83.7 25.4,80 27.6,68.7 20,60 27.6,51.3 25.4,40 36.3,36.3 40,25.4 51.3,27.6";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className={cn("size-6 shrink-0", className)}>
      <rect width="120" height="120" rx="28" fill="#0A0A0A" />
      <polygon points={BURST_POINTS} fill="#C8F135" stroke="#C8F135" strokeWidth="4" strokeLinejoin="round" />
      <path d="M52 46 L52 74 L74 60 Z" fill="#0A0A0A" stroke="#0A0A0A" strokeWidth="5" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-gray-1000", className)}>
      <LogoMark />
      <span className="font-black uppercase tracking-[0.06em]">{BRAND.name}</span>
    </span>
  );
}
