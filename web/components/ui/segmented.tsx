import Link from "next/link";
import { cn } from "@/lib/cn";

/** Link-based segmented control for URL-driven filters (works without JavaScript). */
export function SegmentedLinks({ items, active }: { items: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="inline-flex h-10 items-center gap-0.5 rounded-md border border-gray-alpha-400 bg-background-100 p-1">
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={cn(
            "inline-flex h-full items-center gap-1.5 rounded px-3 text-sm transition-colors",
            item.key === active ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:text-gray-1000",
          )}
        >
          {item.label}
          {item.count != null && <span className="text-xs text-gray-900 tabular-nums">{item.count}</span>}
        </Link>
      ))}
    </div>
  );
}
