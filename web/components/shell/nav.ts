import { Captions, Clapperboard, CreditCard, Gauge, GitPullRequest, LayoutGrid, LayoutTemplate, Palette, Plus, Settings, Shield } from "lucide-react";

export const MAIN_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/dashboard/videos", label: "Videos", icon: Clapperboard },
  { href: "/dashboard/new", label: "New video", icon: Plus },
  { href: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/dashboard/reels", label: "Reels", icon: Captions },
  { href: "/dashboard/usage", label: "Usage", icon: Gauge },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

// Roadmap items (PLAN.md Step 8), shown disabled so customers see what's coming.
export const SOON_NAV = [
  { label: "Release videos", icon: GitPullRequest },
  { label: "Brand kit", icon: Palette },
];

export const ADMIN_NAV = { href: "/dashboard/admin", label: "Admin", icon: Shield };

export function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

const TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/videos": "Videos",
  "/dashboard/new": "New video",
  "/dashboard/start": "New video",
  "/dashboard/templates": "Templates",
  "/dashboard/reels": "Reels",
  "/dashboard/usage": "Usage",
  "/dashboard/billing": "Billing",
  "/dashboard/settings": "Settings",
  "/dashboard/admin": "Admin",
};

export function breadcrumbs(pathname: string): { label: string; href?: string }[] {
  const video = pathname.match(/^\/dashboard\/videos\/([^/]+)/);
  if (video) return [{ label: "Videos", href: "/dashboard/videos" }, { label: video[1].slice(-8) }];
  return [{ label: TITLES[pathname] ?? "Dashboard" }];
}
