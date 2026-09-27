import { cn } from "@/lib/cn";

/** Deterministic gradient avatar, like Vercel's default avatars. */
export function Avatar({ seed, size = 24, className }: { seed: string; size?: number; className?: string }) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-full", className)}
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${hue} 85% 62%), hsl(${(hue + 55) % 360} 85% 48%))` }}
    />
  );
}
