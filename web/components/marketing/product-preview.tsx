import { ChevronRight, Globe, GitBranch } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { StatusDot } from "@/components/ui/status";

const ROWS = [
  { host: "yourproduct.com", id: "k2h8n4a1", status: "SUCCEEDED" as const, time: "13m 3s", tone: "Polished", fmt: "16:9 · 20s", when: "2m ago", repo: false, hue: 252 },
  { host: "you/cli-tool", id: "q1r9c2x7", status: "RUNNING" as const, time: "4m 12s", tone: "YC parody", fmt: "9:16 · 20s", when: "5m ago", repo: true, hue: 148 },
  { host: "app.yourstartup.io", id: "z7t4m0p3", status: "QUEUED" as const, time: "Waiting", tone: "Cinematic", fmt: "1:1 · 15s", when: "just now", repo: false, hue: 24 },
];

/** Static illustration of the dashboard for the landing page (no data, no external images). */
export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-100 shadow-menu">
      <div className="flex h-11 items-center gap-2 border-b border-gray-alpha-400 px-4">
        <LogoMark className="size-5" />
        <span className="text-sm font-medium">Videos</span>
        <span className="ml-auto flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-gray-alpha-400" />
          <span className="size-2.5 rounded-full bg-gray-alpha-400" />
          <span className="size-2.5 rounded-full bg-gray-alpha-400" />
        </span>
      </div>
      <div className="divide-y divide-gray-alpha-400">
        {ROWS.map((r) => (
          <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_16px]">
            <div className="flex min-w-0 items-center gap-3">
              <div className="aspect-video w-[72px] shrink-0 rounded-md border border-gray-alpha-400" style={{ background: `linear-gradient(135deg, hsl(${r.hue} 80% 60% / .9), hsl(${r.hue + 40} 80% 45% / .9))` }} />
              <div className="min-w-0 text-left">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {r.repo ? <GitBranch className="size-3.5 text-gray-900" /> : <Globe className="size-3.5 text-gray-900" />}
                  {r.host}
                </p>
                <p className="font-mono text-xs text-gray-900">{r.id}</p>
              </div>
            </div>
            <div className="hidden text-left sm:block">
              <StatusDot status={r.status} />
              <p className="mt-0.5 pl-[18px] text-xs tabular-nums text-gray-900">{r.time}</p>
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm">{r.tone}</p>
              <p className="mt-0.5 text-xs text-gray-900">{r.fmt}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusDot status={r.status} label={false} className="sm:hidden" />
              <ChevronRight className="size-4 text-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
