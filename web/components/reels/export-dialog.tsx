"use client";
import { Check, Lock, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Option = { label: string; detail?: string; on?: boolean };

// What an export is today, and what Premium adds later (docs/ROADMAP.md, Phase 3): shown, but not choosable yet.
const GROUPS: { label: string; options: Option[] }[] = [
  { label: "Resolution", options: [{ label: "1080p", detail: "Full HD", on: true }, { label: "4K", detail: "Premium, soon" }] },
  { label: "Frame rate", options: [{ label: "30 fps", on: true }, { label: "60 fps", detail: "Premium, soon" }] },
  { label: "Format", options: [{ label: "MP4", detail: "H.264", on: true }, { label: "MOV", detail: "Soon" }, { label: "WebM", detail: "Soon" }] },
];

/**
 * Export, as a dialog: the resolution, watermark, frame rate and format the reel will have, then Export. What Hyped
 * can't make yet shows locked. `watermark`: a free-trial reel keeps the "Made with Hyped" mark until a pack is bought.
 */
export function ExportDialog({ open, onClose, onExport, watermark, until }: { open: boolean; onClose: () => void; onExport: () => void; watermark: boolean; until: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="export-title"
      className="m-auto w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-gray-alpha-400 bg-background-100 p-0 text-gray-1000 shadow-2xl backdrop:bg-black/70"
    >
      <div className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="export-title" className="text-base font-semibold">
              Export
            </h2>
            <p className="mt-0.5 text-[13px] text-gray-900">Ready to share your reel?</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-8 items-center justify-center rounded-md text-gray-900 hover:bg-gray-alpha-200 hover:text-gray-1000">
            <X className="size-4" />
          </button>
        </div>

        <Group label="Watermark">
          <Choice label="With watermark" detail="Free trial" on={watermark} locked={!watermark} />
          <Choice label="Clean" detail={watermark ? "With any pack" : "No mark"} on={!watermark} locked={watermark} />
        </Group>
        {watermark && (
          <p className="-mt-3 text-[13px] text-gray-900">
            <Link href="/dashboard/billing" className="underline underline-offset-2 hover:text-gray-1000">
              Buy a pack
            </Link>{" "}
            and your next reels come out clean.
          </p>
        )}
        {GROUPS.map((g) => (
          <Group key={g.label} label={g.label}>
            {g.options.map((o) => (
              <Choice key={o.label} label={o.label} detail={o.detail} on={o.on} locked={!o.on} />
            ))}
          </Group>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-gray-alpha-400 px-5 py-3">
        <p className="text-[13px] text-gray-900">Exports are free until {until}.</p>
        <Button variant="primary" onClick={() => (onExport(), onClose())}>
          Export
        </Button>
      </div>
    </dialog>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-gray-900">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  );
}

function Choice({ label, detail, on, locked }: { label: string; detail?: string; on?: boolean; locked?: boolean }) {
  return (
    <div className={cn("relative rounded-lg border px-3 py-2", on ? "border-gray-1000 bg-gray-alpha-100" : "border-gray-alpha-400", locked && "opacity-55")}>
      <p className="text-sm font-medium">{label}</p>
      {detail && <p className="text-[11px] text-gray-900">{detail}</p>}
      <span className="absolute right-2 top-2 text-gray-900">{on ? <Check className="size-3.5 text-gray-1000" /> : locked ? <Lock className="size-3" /> : null}</span>
    </div>
  );
}
