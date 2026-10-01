import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// The public pages. Share pages (/v/…) are unlisted and stay out.
const PAGES = ["", "/templates", "/contact", "/terms", "/privacy", "/refunds"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: `${BRAND.url}${path}`, changeFrequency: path ? "monthly" : "weekly", priority: path ? 0.5 : 1 }));
}
