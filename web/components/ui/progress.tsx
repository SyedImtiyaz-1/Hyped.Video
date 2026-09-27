import { cn } from "@/lib/cn";

export function Progress({ value, className, tone = "default" }: { value: number; className?: string; tone?: "default" | "warning" }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-gray-alpha-200", className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width]", tone === "warning" ? "bg-amber-700" : "bg-gray-1000")} style={{ width: `${pct}%` }} />
    </div>
  );
}
