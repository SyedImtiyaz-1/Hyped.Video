import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// Cloudflare adds its content-signals preamble above these rules. Share pages (/v/…) stay crawlable so search engines
// can read their noindex; they're unlisted, not secret.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/api/"] }],
    sitemap: `${BRAND.url}/sitemap.xml`,
  };
}
