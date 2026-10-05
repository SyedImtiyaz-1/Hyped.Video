"use client";
import { RotateCcw, Scissors } from "lucide-react";
import { TRIM_REASONS, trimAt, trimTotals, type Trim, type TrimReason } from "@launchreel/core/trims";
import type { ReelEdit } from "@launchreel/core/reel";
import { cn } from "@/lib/cn";

const clock = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const seconds = (s: number) => `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;

/** How each kind of cut reads: its tag, a count of them, and its put-back button. */
export const TRIM_LABEL: Record<TrimReason, { tag: string; count: (n: number) => string; restore: (n: number) => string }> = {
  pause: { tag: "Pause", count: (n) => (n === 1 ? "1 pause" : `${n} pauses`), restore: (n) => (n === 1 ? "Put back the pause" : `Put back all ${n} pauses`) },
  filler: { tag: "Filler", count: (n) => (n === 1 ? "1 filler" : `${n} fillers`), restore: (n) => (n === 1 ? "Put back the filler" : `Put back all ${n} fillers`) },
  retake: { tag: "Retake", count: (n) => (n === 1 ? "1 retake" : `${n} retakes`), restore: (n) => (n === 1 ? "Put back the retake" : `Put back all ${n} retakes`) },
  cut: { tag: "Your cut", count: (n) => (n === 1 ? "1 cut of yours" : `${n} cuts of yours`), restore: (n) => (n === 1 ? "Put back your cut" : `Put back all ${n} of your cuts`) },
};

export type TrimActions = {
  /** Puts a cut back. */
  restore: (index: number) => void;
  /** Puts every cut of a kind back (or all of them). */
  restoreAll: (reason?: TrimReason) => void;
  /** Cuts every long pause (from the word timings). */
  cutPauses: () => void;
  select: (index: number) => void;
};

/** The words a trim cuts, as text. */
function cutText(edit: ReelEdit, trim: Trim) {
  return edit.words
    .filter((w) => (w.start + w.end) / 2 >= trim.start && (w.start + w.end) / 2 < trim.end)
    .map((w) => w.text)
    .join(" ");
}

/**
 * What's cut out of the recording: long pauses, filler sounds and retakes the AI found, and the customer's own cuts.
 * Each can be put back; a word can be cut from the Text tab.
 */
export function CutsPanel({ edit, cutLength, time, selected, actions }: { edit: ReelEdit; cutLength: number; time: number; selected: number | null; actions: TrimActions }) {
  const trims = edit.trims;
  const totals = trimTotals(trims);
  const removed = trims.reduce((s, t) => s + (t.end - t.start), 0);
  const playing = trimAt(trims, time);
  const kinds = TRIM_REASONS.filter((r) => totals[r].count);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-alpha-400 p-3">
        <p className="text-sm font-medium text-gray-1000">{trims.length ? `${seconds(removed)} cut: ${clock(edit.duration)} becomes ${clock(cutLength)}` : "Nothing is cut"}</p>
        <p className="mt-0.5 text-xs text-gray-900">
          {trims.length ? `${kinds.map((r) => `${TRIM_LABEL[r].count(totals[r].count)} (${seconds(totals[r].seconds)})`).join(", ")}. The preview skips them as it plays.` : "Every second of the recording plays. Cut the long pauses, or cut words from the Text tab."}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button type="button" onClick={actions.cutPauses} className="flex h-8 items-center gap-1.5 rounded-md border border-gray-alpha-400 px-2.5 text-[13px] text-gray-1000 hover:bg-gray-alpha-100">
            <Scissors className="size-3.5" />
            Cut long pauses
          </button>
          {kinds.map((r) => (
            <button key={r} type="button" onClick={() => actions.restoreAll(r)} className="flex h-8 items-center gap-1.5 rounded-md border border-gray-alpha-400 px-2.5 text-[13px] text-gray-1000 hover:bg-gray-alpha-100">
              <RotateCcw className="size-3.5" />
              {TRIM_LABEL[r].restore(totals[r].count)}
            </button>
          ))}
          {kinds.length > 1 && (
            <button type="button" onClick={() => actions.restoreAll()} className="flex h-8 items-center gap-1.5 rounded-md border border-gray-alpha-400 px-2.5 text-[13px] text-gray-1000 hover:bg-gray-alpha-100">
              <RotateCcw className="size-3.5" />
              Put everything back
            </button>
          )}
        </div>
      </div>

      {trims.length > 0 && (
        <ul className="space-y-1">
          {trims.map((t, i) => {
            const words = cutText(edit, t);
            return (
              <li key={`${t.start}-${t.end}`} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5", (i === selected || i === playing) && "bg-gray-alpha-100 ring-1 ring-gray-alpha-400")}>
                <button type="button" onClick={() => actions.select(i)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left">
                  <span className="w-12 shrink-0 text-xs tabular-nums text-gray-900">{clock(t.start)}</span>
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium", t.reason === "cut" ? "bg-gray-alpha-200 text-gray-1000" : "bg-red-200 text-red-1000")}>{TRIM_LABEL[t.reason].tag}</span>
                  <span className="min-w-0 truncate text-[13px] text-gray-1000">{words ? <span className="line-through decoration-red-900/60">{words}</span> : <span className="text-gray-900">silence</span>}</span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-gray-900">{seconds(t.end - t.start)}</span>
                </button>
                <button type="button" onClick={() => actions.restore(i)} className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-gray-alpha-400 px-2 text-xs text-gray-1000 hover:bg-gray-alpha-100" aria-label={`Put back the ${TRIM_LABEL[t.reason].tag.toLowerCase()} at ${clock(t.start)}`}>
                  <RotateCcw className="size-3" />
                  Put back
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
