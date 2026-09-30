"use client";
import type { JobStatus } from "@launchreel/core";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/format";
import { Kbd } from "@/components/ui/kbd";
import { StatusDot } from "@/components/ui/status";
import { VideoThumb } from "@/components/video/video-thumb";
import { MAIN_NAV } from "./nav";

type Hit = { id: string; title: string; status: JobStatus; posterUrl: string | null; createdAt: string; revision: boolean };
type Item = { key: string; href: string } & ({ kind: "video"; hit: Hit } | { kind: "page"; label: string; icon: (typeof MAIN_NAV)[number]["icon"] } | { kind: "all" });

/** Sidebar search: matching videos and pages appear as you type; arrows and Enter pick one, Esc closes. */
export function SearchBox() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  // Press "F" anywhere (outside a text field) to jump to search, like Vercel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key.toLowerCase() !== "f" || e.metaKey || e.ctrlKey || e.altKey || t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced, and each new query cancels the request still in flight.
  useEffect(() => {
    const query = q.trim();
    setActive(0);
    if (!query) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        setHits(res.ok ? ((await res.json()) as { videos: Hit[] }).videos : []);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setHits([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const query = q.trim();
  const pages = query ? MAIN_NAV.filter((n) => n.label.toLowerCase().includes(query.toLowerCase())) : [];
  const items: Item[] = [
    ...hits.map((hit): Item => ({ key: hit.id, href: `/dashboard/videos/${hit.id}`, kind: "video", hit })),
    ...pages.map((p): Item => ({ key: p.href, href: p.href, kind: "page", label: p.label, icon: p.icon })),
    ...(hits.length ? [{ key: "all", href: `/dashboard/videos?q=${encodeURIComponent(query)}`, kind: "all" } as Item] : []),
  ];
  const showList = open && query.length > 0;

  function go(href: string) {
    setOpen(false);
    setQ("");
    input.current?.blur();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    } else if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!query) return;
      // Enter before results arrive searches all videos.
      go(items[active]?.href ?? `/dashboard/videos?q=${encodeURIComponent(query)}`);
    }
  }

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2.5 size-4 text-gray-900" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Find…"
          role="combobox"
          aria-label="Find videos and pages"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && items[active] ? `${listId}-${items[active].key}` : undefined}
          className="h-8 w-full rounded-md border border-gray-alpha-400 bg-background-100 pl-8 pr-8 text-sm placeholder:text-gray-900 hover:border-gray-alpha-500 focus:border-gray-alpha-600 focus:outline-none focus:ring-4 focus:ring-gray-alpha-200"
        />
        <Kbd className="absolute right-1.5">F</Kbd>
      </div>

      {showList && (
        <div
          id={listId}
          role="listbox"
          // Keep focus in the input so a click lands before blur closes the list.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 top-full z-50 mt-1.5 w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-alpha-400 bg-background-100 p-1 shadow-menu"
        >
          {items.length === 0 ? (
            <p className="px-3 py-2.5 text-[13px] text-gray-900">{loading ? "Searching…" : `No videos or pages match “${query}”.`}</p>
          ) : (
            items.map((item, i) => (
              <div
                key={item.key}
                id={`${listId}-${item.key}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.href)}
                className={cn("flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm", i === active ? "bg-gray-alpha-200" : "hover:bg-gray-alpha-100")}
              >
                {item.kind === "video" ? (
                  <>
                    <VideoThumb job={item.hit} className="w-[56px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gray-1000">{item.hit.title}</span>
                      <span className="flex items-center gap-2 text-xs text-gray-900">
                        <StatusDot status={item.hit.status} className="text-xs text-gray-900" />
                        <span>· {timeAgo(item.hit.createdAt)}</span>
                        {item.hit.revision && <span>· Revision</span>}
                      </span>
                    </span>
                  </>
                ) : item.kind === "page" ? (
                  <>
                    <span className="flex w-[56px] justify-center text-gray-900">
                      <item.icon className="size-4" />
                    </span>
                    <span className="flex-1 text-gray-1000">{item.label}</span>
                    <span className="text-xs text-gray-900">Page</span>
                  </>
                ) : (
                  <>
                    <span className="flex w-[56px] justify-center text-gray-900">
                      <Search className="size-4" />
                    </span>
                    <span className="flex-1 truncate text-gray-1000">All videos matching “{query}”</span>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
