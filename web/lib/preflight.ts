/**
 * Cheap checks before any AI tokens are spent: a failed render still costs real money,
 * so anything we can reject up front for free, we do.
 */

/**
 * Whether GitHub shows the repo publicly. Without a token, GitHub answers 404 for both private and missing
 * repos ("hidden"). "unknown" means GitHub didn't say (rate limits are common on shared IPs).
 */
export async function githubVisibility(url: string): Promise<"public" | "hidden" | "unknown"> {
  try {
    const [, owner, repo] = new URL(url).pathname.split("/");
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo?.replace(/\.git$/, "")}`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "launch-video-preflight" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return "hidden";
    if (res.ok) return ((await res.json()) as { private?: boolean }).private ? "hidden" : "public";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** A reason to reject a website up front, or null to go ahead. */
export async function websiteProblem(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "user-agent": "Mozilla/5.0 (compatible; launch-video-preflight)" } });
    if (res.status === 404 || res.status === 410) return `That page returned ${res.status}. Check the URL.`;
    if (res.status >= 500) return `That site is returning errors (${res.status}). Try again when it's back up.`;
    return null; // 2xx/3xx, or 401/403 bot protection the real browser may pass
  } catch {
    return "We couldn't reach that site. Check the URL, or try again in a minute.";
  }
}
