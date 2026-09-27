import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6 shrink-0", className)}>
      <rect width="24" height="24" rx="6" className="fill-gray-1000" />
      <path d="M9.5 7.6v8.8a.6.6 0 0 0 .9.52l7.1-4.4a.6.6 0 0 0 0-1.04l-7.1-4.4a.6.6 0 0 0-.9.52Z" className="fill-background-100" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-gray-1000", className)}>
      <LogoMark />
      {BRAND.name}
    </span>
  );
}
