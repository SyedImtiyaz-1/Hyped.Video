import type { JobStatus } from "@launchreel/core";
import { cn } from "@/lib/cn";

export const STATUS: Record<JobStatus, { label: string; dot: string; tone: "gray" | "amber" | "green" | "red" }> = {
  QUEUED: { label: "Queued", dot: "bg-gray-700", tone: "gray" },
  RUNNING: { label: "Rendering", dot: "bg-amber-700 animate-pulse-dot", tone: "amber" },
  SUCCEEDED: { label: "Ready", dot: "bg-green-700", tone: "green" },
  FAILED: { label: "Error", dot: "bg-red-800", tone: "red" },
};

export function StatusDot({ status, label = true, className }: { status: JobStatus; label?: boolean; className?: string }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-gray-1000", className)}>
      <span className={cn("size-2.5 shrink-0 rounded-full", s.dot)} aria-hidden />
      {label ? s.label : <span className="sr-only">{s.label}</span>}
    </span>
  );
}
