import { cn } from "@/lib/cn";

export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded border border-gray-alpha-400 bg-background-100 px-1 font-sans text-[11px] font-medium text-gray-900", className)}>
      {children}
    </kbd>
  );
}
