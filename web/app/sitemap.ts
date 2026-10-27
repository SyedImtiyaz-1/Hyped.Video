import type { MetadataRoute } from "next";
import { RECIPES } from "@launchreel/core/recipes";
import { BRAND } from "@/lib/brand";

// The public pages, each recipe's own page included. Share pages (/v/…) are unlisted and stay out.
const PAGES = ["", "/recipes", ...RECIPES.filter((r) => r.status === "live").map((r) => `/recipes/${r.id}`), "/contact", "/terms", "/privacy", "/refunds"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: `${BRAND.url}${path}`, changeFrequency: path ? "monthly" : "weekly", priority: path ? 0.5 : 1 }));
}
