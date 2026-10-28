"use client";
import { ArrowUpRight, MessageCircle, PanelLeft, Play, Plus, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";
import { plural } from "@/lib/format";
import { HERO, posterSrc } from "@/lib/showcase";
import { LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ACCOUNT_NAV, ADMIN_NAV, MAIN_NAV, PRIMARY_NAV, breadcrumbs, isActive, type NavItem } from "./nav";
import { LogOutButton } from "./log-out-button";
import { SearchBox } from "./search-box";

export type ShellProps = {
  credits: number;
  /** Reel credits from a reel pack (they only make reels). */
  reelCredits?: number;
  email: string;
  isAdmin: boolean;
  demo: boolean;
  userSlot: React.ReactNode;
  children: React.ReactNode;
};

const COLLAPSE_KEY = "sidebar:collapsed";

/**
 * The dashboard's frame: the sidebar on the page's background, and the page itself on a raised, rounded panel beside it.
 * Home has no top bar on wide screens (it starts with its greeting); every other page keeps its breadcrumbs.
 */
export function AppShell(props: ShellProps) {
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
      // The dashboard is dark until the customer picks a theme (the toggle at the sidebar's foot; next-themes' key).
      if (!localStorage.getItem("theme")) setTheme("dark");
    } catch {}
  }, [setTheme]);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  return (
    <div className="flex min-h-dvh bg-background-200">
      <Sidebar {...props} collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        {/* overflow-clip, not overflow-hidden: it rounds the corners without breaking the top bar's sticky. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-clip bg-background-100 md:rounded-2xl md:border md:border-gray-alpha-400">
          <Topbar demo={props.demo} userSlot={props.userSlot} home={pathname === "/dashboard"} />
          {props.demo && (
            <div className="border-b border-blue-400 bg-blue-100 px-4 py-2 text-center text-[13px] text-blue-900">
              Demo mode: sample data, nothing is saved.
              <span className="hidden sm:inline"> Sample videos come from the open-source brag project&apos;s examples.</span>
            </div>
          )}
          <main className="flex-1 pb-28 md:pb-0">{props.children}</main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}

function Sidebar({ credits, reelCredits = 0, email, isAdmin, userSlot, demo, collapsed, onToggle }: ShellProps & { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const lowCredits = credits < 1;
  return (
    <aside className={cn("sticky top-0 z-40 hidden h-dvh shrink-0 flex-col bg-background-200 transition-[width] duration-200 md:flex", collapsed ? "w-[60px]" : "w-[248px]")}>
      <div className={cn("flex items-center gap-1", collapsed ? "flex-col px-2 py-3" : "h-14 px-3")}>
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 hover:bg-gray-alpha-100" title={BRAND.name}>
          <LogoMark />
          {!collapsed && <span className="truncate text-sm font-semibold">{BRAND.name}</span>}
        </Link>
        <button type="button" onClick={onToggle} className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-900 hover:bg-gray-alpha-200 hover:text-gray-1000" aria-label="Toggle sidebar" title="Toggle sidebar">
          <PanelLeft className="size-4" />
        </button>
      </div>

      {/* Outside the scrolling area, so the results list isn't clipped. */}
      {!collapsed && (
        <div className="px-3 pt-1">
          <SearchBox />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <nav className="space-y-0.5" aria-label="Main">
          {PRIMARY_NAV.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(pathname, item.href, item.exact)} collapsed={collapsed} />
          ))}
        </nav>
      </div>

      <div className="space-y-0.5 p-3">
        {/* What's new: the latest thing worth trying, with a glimpse of it. */}
        {!collapsed && (
          <Link href="/dashboard/recipes" className="group mb-2 block overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-100 transition-colors hover:border-gray-alpha-500">
            <div className="flex items-center justify-between px-3 pt-2.5 text-[13px] font-medium text-gray-1000">
              What&apos;s new
              <ArrowUpRight className="size-3.5 text-gray-900 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
            </div>
            <div className="relative mx-3 mt-2 aspect-video overflow-hidden rounded-lg bg-[radial-gradient(120%_140%_at_0%_0%,rgb(200_241_53/0.22),transparent_60%)]">
              {HERO && (
                // eslint-disable-next-line @next/next/no-img-element -- posters come from our own storage domain
                <img src={posterSrc(HERO)} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.display = "none")} className="size-full object-cover" />
              )}
              <span className="absolute inset-0 m-auto flex size-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                <Play className="size-3.5" fill="currentColor" />
              </span>
            </div>
            <p className="px-3 pb-2.5 pt-2 text-xs text-gray-900">
              <span className="font-medium text-gray-1000">Templates are here.</span> Pick a proven video, add your product, remix it.
            </p>
          </Link>
        )}
        <Link
          href="/dashboard/billing"
          title={collapsed ? `${credits} credits left` : undefined}
          className={cn("flex h-9 items-center gap-2.5 rounded-md px-2 text-sm text-gray-1000 transition-colors hover:bg-gray-alpha-100", collapsed && "justify-center px-0")}
        >
          <Zap className={cn("size-4 shrink-0", lowCredits && "text-amber-900")} />
          {!collapsed && (
            <>
              Buy credits
              <span className={cn("ml-auto text-xs tabular-nums", lowCredits ? "text-amber-900" : "text-gray-900")}>
                {credits} left{reelCredits > 0 && ` · ${plural(reelCredits, "reel")}`}
              </span>
            </>
          )}
        </Link>
        {ACCOUNT_NAV.map((item) => (
          <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} muted />
        ))}
        {isAdmin && <SideLink item={ADMIN_NAV} active={isActive(pathname, ADMIN_NAV.href)} collapsed={collapsed} muted />}
        <a
          href={`mailto:${BRAND.supportEmail}`}
          title={collapsed ? "Need any help?" : undefined}
          className={cn("flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-gray-900 transition-colors hover:bg-gray-alpha-100 hover:text-gray-1000", collapsed && "justify-center px-0")}
        >
          <MessageCircle className="size-4 shrink-0" />
          {!collapsed && "Need any help?"}
        </a>
        <div className={cn("flex items-center gap-2 pt-2", collapsed && "flex-col")}>
          {userSlot}
          {!collapsed && <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900">{email}</span>}
          {!collapsed && <ThemeToggle />}
          {!demo && <LogOutButton variant="icon" />}
        </div>
      </div>
    </aside>
  );
}

function SideLink({ item: { href, label, icon: Icon }, active, collapsed, muted }: { item: NavItem; active: boolean; collapsed: boolean; muted?: boolean }) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 transition-colors",
        muted ? "h-8 text-[13px]" : "h-9 text-sm",
        collapsed && "justify-center px-0",
        active ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && label}
    </Link>
  );
}

function Topbar({ demo, userSlot, home }: { demo: boolean; userSlot: React.ReactNode; home: boolean }) {
  const pathname = usePathname();
  const crumbs = breadcrumbs(pathname);
  return (
    <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-alpha-400 bg-background-100/80 px-4 backdrop-blur md:px-6", home && "md:hidden")}>
      <Link href="/dashboard" className="-ml-2 flex size-10 items-center justify-center md:hidden" aria-label="Dashboard">
        <LogoMark />
      </Link>
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-2">
            {i > 0 && <span className="text-gray-alpha-500">/</span>}
            {c.href ? (
              <Link href={c.href} className="truncate text-gray-900 hover:text-gray-1000">
                {c.label}
              </Link>
            ) : (
              <span className={cn("truncate font-medium text-gray-1000", i > 0 && "font-mono text-[13px]")}>{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {demo && <Badge tone="blue">Demo</Badge>}
        {/* Pages with their own way to start a video, and phones (bottom bar), don't need this one. */}
        {!["/dashboard", "/dashboard/videos", "/dashboard/new"].includes(pathname) && (
          <ButtonLink href="/dashboard/new" variant="primary" size="sm" className="hidden md:inline-flex">
            <Plus />
            New video
          </ButtonLink>
        )}
        {/* Phones have no sidebar: the account menu (profile, log out) lives up here. */}
        <div className="flex size-10 items-center justify-center md:hidden">{userSlot}</div>
      </div>
    </header>
  );
}

// The phones' bottom bar, in this order, with "New video" in the middle.
const MOBILE = ["/dashboard", "/dashboard/recipes", "/dashboard/new", "/dashboard/videos", "/dashboard/settings"];

function MobileNav() {
  const pathname = usePathname();
  const items = MOBILE.map((href) => MAIN_NAV.find((i) => i.href === href)).filter((i): i is NavItem => Boolean(i));
  return (
    <nav className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit items-center gap-1 rounded-full border border-gray-alpha-400 bg-background-100/90 p-1.5 shadow-menu backdrop-blur md:hidden" aria-label="Main">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        const primary = href === "/dashboard/new";
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex size-11 items-center justify-center rounded-full transition-colors",
              primary ? "bg-gray-1000 text-background-100" : active ? "bg-gray-alpha-200 text-gray-1000" : "text-gray-900",
            )}
          >
            <Icon className="size-5" />
          </Link>
        );
      })}
    </nav>
  );
}
