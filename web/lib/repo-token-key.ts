import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { RepoTokenJwk } from "@launchreel/core/repo-token";

/**
 * The public key browsers encrypt private-repo tokens with (web Worker var REPO_TOKEN_PUBLIC_KEY; .env in local
 * dev). Returns null when it's missing or invalid, which turns private repos off. If a private key was put here
 * by mistake, it is refused rather than sent to browsers.
 */
export async function getRepoTokenPublicKey(): Promise<RepoTokenJwk | null> {
  let raw = process.env.REPO_TOKEN_PUBLIC_KEY;
  try {
    const { env } = await getCloudflareContext({ async: true });
    raw = (env as { REPO_TOKEN_PUBLIC_KEY?: string }).REPO_TOKEN_PUBLIC_KEY || raw;
  } catch {
    // Not running on Cloudflare: use process.env.
  }
  if (!raw) return null;
  try {
    const jwk = JSON.parse(raw) as RepoTokenJwk;
    if ("d" in jwk) {
      console.error("[repo-token] REPO_TOKEN_PUBLIC_KEY contains a private key. Refusing to use it; generate new keys.");
      return null;
    }
    if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.x || !jwk.y || !jwk.kid) return null;
    return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, kid: jwk.kid };
  } catch {
    return null;
  }
}
