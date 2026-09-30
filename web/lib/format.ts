const MIN = 60;
const HOUR = 3600;
const DAY = 86400;

export function timeAgo(input: Date | string, now = Date.now()): string {
  const date = new Date(input);
  const s = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < HOUR) return `${Math.max(1, Math.round(s / MIN))}m ago`;
  if (s < DAY) return `${Math.round(s / HOUR)}h ago`;
  if (s < 7 * DAY) return `${Math.round(s / DAY)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  if (s < MIN) return `${s}s`;
  if (s < HOUR) return `${Math.floor(s / MIN)}m ${s % MIN}s`;
  return `${Math.floor(s / HOUR)}h ${Math.floor((s % HOUR) / MIN)}m`;
}

/** Wall-clock render time; still counting while the job runs. */
export function renderSeconds(job: { startedAt: Date | null; finishedAt: Date | null }, now = Date.now()): number | null {
  if (!job.startedAt) return null;
  return ((job.finishedAt ?? new Date(now)).getTime() - job.startedAt.getTime()) / 1000;
}

/** "acme.dev" for websites, "owner/repo" for GitHub. */
export function hostOf(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "github.com") return u.pathname.replace(/^\/|\/$/g, "");
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export const shortId = (id: string) => id.slice(-8);

export function formatDateTime(input: Date | string): string {
  return new Date(input).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const TONE_LABELS: Record<string, string> = { "yc-parody": "YC parody", "app-store": "App Store" };
export function toneLabel(tone: string | null): string {
  if (!tone) return "Auto tone";
  return TONE_LABELS[tone] ?? tone.charAt(0).toUpperCase() + tone.slice(1).replace(/-/g, " ");
}

export const FORMAT_LABEL: Record<string, string> = { landscape: "16:9", vertical: "9:16", square: "1:1" };

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Quality tier names: the only thing customers see of the engine behind each tier. */
export const QUALITY_LABEL: Record<string, string> = { standard: "Standard", studio: "Studio" };

/** "$12", "$2.42", "₹1,999", "₹167": a price as customers see it. Fractions round up, so a price is never understated. */
export function money(amount: number, currency: "usd" | "inr"): string {
  if (currency === "inr") return `₹${Math.ceil(amount).toLocaleString("en-IN")}`;
  return Number.isInteger(amount) ? `$${amount}` : `$${(Math.ceil(amount * 100) / 100).toFixed(2)}`;
}
