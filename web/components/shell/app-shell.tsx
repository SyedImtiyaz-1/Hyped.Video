"use client";
import { PanelLeft, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";
import { plural } from "@/lib/format";
import { LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ADMIN_NAV, MAIN_NAV, SOON_NAV, breadcrumbs, isActive } from "./nav";
import { LogOutButton } from "./log-out-button";
import { SearchBox } from "./search-box";

export type ShellProps = {
  credits: number;
  email: string;
  isAdmin: boolean;
  demo: boolean;
  userSlot: React.ReactNode;
  children: React.ReactNode;
};

const COLLAPSE_KEY = "sidebar:collapsed";

export function AppShell(props: ShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  return (
    <div className="flex min-h-dvh">
      <Sidebar {...props} collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar demo={props.demo} onToggle={toggle} userSlot={props.userSlot} />
        {props.demo && (
          <div className="border-b border-blue-400 bg-blue-100 px-4 py-2 text-center text-[13px] text-blue-900">
            Demo mode: sample data, nothing is saved.
            <span className="hidden sm:inline"> Sample videos come from the open-source brag project&apos;s examples.</span>
          </div>
        )}
        <main className="flex-1 pb-28 md:pb-0">{props.children}</main>
      </div>
      <MobileNav />
    </div>
  );
}

function Sidebar({ credits, email, isAdmin, userSlot, demo, collapsed }: ShellProps & { collapsed: boolean }) {
  const pathname = usePathname();
  const lowCredits = credits < 1;
  return (
    <aside
      className={cn(
        "sticky top-0 z-40 hidden h-dvh shrink-0 flex-col border-r border-gray-alpha-400 bg-background-100 transition-[width] duration-200 md:flex",
        collapsed ? "w-[60px]" : "w-[248px]",
      )}
    >
      <div className={cn("flex h-14 items-center gap-2 border-b border-gray-alpha-400", collapsed ? "justify-center px-2" : "px-3")}>
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-1.5 hover:bg-gray-alpha-100" title={BRAND.name}>
          <LogoMark />
          {!collapsed && <span className="truncate text-sm font-semibold">{BRAND.name}</span>}
        </Link>
      </div>

      {/* Outside the scrolling area, so the results list isn't clipped. */}
      {!collapsed && (
        <div className="px-3 pt-3">
          <SearchBox />
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <nav className="space-y-0.5">
          {MAIN_NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                  collapsed && "justify-center px-0",
                  active ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && label}
              </Link>
            );
          })}
        </nav>

        {!collapsed && <p className="mb-1 mt-6 px-2 text-xs font-medium text-gray-900">Coming soon</p>}
        <div className={cn("space-y-0.5", collapsed && "mt-4 border-t border-gray-alpha-400 pt-4")}>
          {SOON_NAV.map(({ label, icon: Icon }) => (
            <div key={label} title={collapsed ? `${label} (coming soon)` : undefined} className={cn("flex h-8 cursor-default items-center gap-2.5 rounded-md px-2 text-sm text-gray-700", collapsed && "justify-center px-0")}>
              <Icon className="size-4 shrink-0" />
              {!collapsed && (
                <>
                  {label}
                  <Badge className="ml-auto">Soon</Badge>
                </>
              )}
            </div>
          ))}
          {isAdmin && (
            <Link
              href={ADMIN_NAV.href}
              title={collapsed ? ADMIN_NAV.label : undefined}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                collapsed && "justify-center px-0",
                isActive(pathname, ADMIN_NAV.href) ? "bg-gray-alpha-200 font-medium text-gray-1000" : "text-gray-900 hover:bg-gray-alpha-100 hover:text-gray-1000",
              )}
            >
              <ADMIN_NAV.icon className="size-4 shrink-0" />
              {!collapsed && ADMIN_NAV.label}
            </Link>
          )}
        </div>
      </div>

      <div className="border-t border-gray-alpha-400 p-3">
        {!collapsed && (
          <Link href="/dashboard/billing" className="mb-3 block rounded-lg border border-gray-alpha-400 p-3 transition-colors hover:bg-gray-alpha-100">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-medium text-gray-1000">Credits</span>
              <span className={cn("tabular-nums", lowCredits ? "text-amber-900" : "text-gray-900")}>{credits} left</span>
            </div>
            <p className="mt-1 text-xs text-gray-900">{lowCredits ? "Buy credits to make more videos" : `Enough for ${plural(credits, "short video")}`}</p>
          </Link>
        )}
        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          {userSlot}
          {!collapsed && <span className="min-w-0 flex-1 truncate text-[13px] text-gray-900">{email}</span>}
          {!collapsed && <ThemeToggle />}
          {!demo && <LogOutButton variant="icon" />}
        </div>
      </div>
    </aside>
  );
}

function Topbar({ demo, onToggle, userSlot }: { demo: boolean; onToggle: () => void; userSlot: React.ReactNode }) {
  const pathname = usePathname();
  const crumbs = breadcrumbs(pathname);
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-alpha-400 bg-background-100/80 px-4 backdrop-blur md:px-6">
      <button type="button" onClick={onToggle} className="hidden size-8 items-center justify-center rounded-md text-gray-900 hover:bg-gray-alpha-200 hover:text-gray-1000 md:flex" aria-label="Toggle sidebar" title="Toggle sidebar">
        <PanelLeft className="size-4" />
      </button>
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
        {/* Pages with their own "New video" button, and phones (bottom bar), don't need this one. */}
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

function MobileNav() {
  const pathname = usePathname();
  const items = MAIN_NAV.filter((i) => ["/dashboard", "/dashboard/videos", "/dashboard/new", "/dashboard/usage", "/dashboard/settings"].includes(i.href));
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
