"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A titled row of tiles that scrolls sideways, with arrows once it's wider than the page. `big` for a section's own
 * title (an h2); otherwise it's a category inside one (an h3).
 */
export function ScrollRow({ title, big, className, children }: { title: string; big?: boolean; className?: string; children: React.ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    const watch = new ResizeObserver(check);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  const scroll = (direction: number) => row.current?.scrollBy({ left: direction * row.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section aria-label={title}>
      <div className="mb-3 flex h-8 items-center justify-between gap-4">
        {big ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : <h3 className="text-sm font-medium text-gray-1000">{title}</h3>}
        {overflows && (
          <div className="flex gap-1.5">
            <Arrow label="Previous" onClick={() => scroll(-1)}>
              <ChevronLeft className="size-4" />
            </Arrow>
            <Arrow label="Next" onClick={() => scroll(1)}>
              <ChevronRight className="size-4" />
            </Arrow>
          </div>
        )}
      </div>
      <div ref={row} className={cn("-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)}>
        {children}
      </div>
    </section>
  );
}

function Arrow({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex size-8 items-center justify-center rounded-full text-gray-900 transition-colors hover:bg-gray-alpha-200 hover:text-gray-1000">
      {children}
    </button>
  );
}
