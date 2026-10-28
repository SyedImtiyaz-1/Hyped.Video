"use client";
import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";

/**
 * A panel over the page next to `anchor`: the browser's own popover, so it sits above everything (clipped by nothing),
 * closes on a click outside or Escape, and puts focus back. Below the anchor when there's room, else above it; a sheet
 * along the bottom on phones.
 */
export function Popover({ anchor, open, onClose, label, width = 320, className, children }: { anchor: RefObject<HTMLElement | null>; open: boolean; onClose: () => void; label: string; width?: number; className?: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useLayoutEffect(() => {
    const p = panel.current;
    if (!p) return;
    if (!open) {
      if (p.matches(":popover-open")) p.hidePopover();
      return;
    }
    if (!p.matches(":popover-open")) p.showPopover();
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const phone = window.innerWidth < 640;
      if (phone || !a) {
        Object.assign(p.style, { left: "8px", right: "8px", top: "auto", bottom: "8px", width: "auto", maxHeight: "70vh" });
        return;
      }
      const w = Math.min(width, window.innerWidth - 16);
      const h = p.offsetHeight;
      const below = a.bottom + 6 + h <= window.innerHeight - 8 || a.top - 6 - h < 8;
      Object.assign(p.style, {
        width: `${w}px`,
        right: "auto",
        bottom: "auto",
        maxHeight: `${Math.max(200, (below ? window.innerHeight - a.bottom : a.top) - 16)}px`,
        left: `${Math.min(window.innerWidth - w - 8, Math.max(8, a.left))}px`,
        top: `${below ? a.bottom + 6 : Math.max(8, a.top - 6 - h)}px`,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchor, width]);

  useEffect(() => {
    const p = panel.current;
    if (!p) return;
    const toggled = (e: Event) => {
      if ((e as ToggleEvent).newState === "closed") close.current();
    };
    p.addEventListener("toggle", toggled);
    return () => p.removeEventListener("toggle", toggled);
  }, []);

  return (
    <div ref={panel} popover="auto" role="dialog" aria-label={label} className={cn("m-0 overflow-auto bg-transparent p-0 text-gray-1000 [position:fixed]", className)}>
      {open && children}
    </div>
  );
}
