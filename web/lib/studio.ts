import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Whether customers can order Studio videos: web Worker var STUDIO_ENABLED ("true" turns it on; .env in local dev).
 * Studio runs on Claude, so it shows "Coming soon" until the render Worker has a working ANTHROPIC_API_KEY. Without
 * one, every Studio render fails and is refunded.
 */
export async function studioAvailable(): Promise<boolean> {
  let raw = process.env.STUDIO_ENABLED;
  try {
    const { env } = await getCloudflareContext({ async: true });
    raw = (env as { STUDIO_ENABLED?: string }).STUDIO_ENABLED ?? raw;
  } catch {
    // Not running on Cloudflare: use process.env.
  }
  return raw === "true";
}

export const STUDIO_SOON_ERROR = "Studio is coming soon. Choose Standard for now.";
