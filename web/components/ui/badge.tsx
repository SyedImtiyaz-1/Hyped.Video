import { cn } from "@/lib/cn";

const TONES = {
  gray: "bg-gray-200 text-gray-1000",
  blue: "bg-blue-200 text-blue-900",
  green: "bg-green-200 text-green-900",
  amber: "bg-amber-200 text-amber-900",
  red: "bg-red-200 text-red-900",
  purple: "bg-purple-200 text-purple-900",
  teal: "bg-teal-200 text-teal-900",
  inverted: "bg-gray-1000 text-background-100",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({ tone = "gray", size = "sm", className, children }: { tone?: BadgeTone; size?: "sm" | "md"; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium [&_svg]:size-3",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
