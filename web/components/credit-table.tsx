import { QUALITIES } from "@launchreel/core/contract";
import { creditsFor } from "@launchreel/core/pricing";
import { cn } from "@/lib/cn";
import { QUALITY_LABEL } from "@/lib/format";

const LENGTHS = [30, 60, 90];

/** Credits per video by quality and length, computed from the pricing rules so it never goes stale. */
export function CreditTable({ className, studioSoon }: { className?: string; studioSoon?: boolean }) {
  return (
    <table className={cn("w-full text-sm", className)}>
      <thead>
        <tr className="text-left text-xs text-gray-900">
          <th className="py-2 pr-4 font-medium">Credits per video</th>
          {LENGTHS.map((s) => (
            <th key={s} className="py-2 pr-4 font-medium">
              Up to {s}s
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-alpha-400 border-t border-gray-alpha-400">
        {QUALITIES.map((q) => (
          <tr key={q}>
            <td className="py-2 pr-4 font-medium text-gray-1000">
              {QUALITY_LABEL[q]}
              {q === "studio" && studioSoon && <span className="block text-[11px] font-normal text-gray-900">Coming soon</span>}
            </td>
            {LENGTHS.map((s) => (
              <td key={s} className="py-2 pr-4 tabular-nums text-gray-1000">
                {creditsFor("newVideo", s, q)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
