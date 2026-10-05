// Stock B-roll: short clips laid over the speaker while they keep talking (the voice and the captions carry on), found
// from a search the planner writes for the moment ("typing on a laptop"), or picked in the editor. Two free libraries,
// whichever the render Worker has a key for (Pexels first: it can search by orientation): Pexels and Pixabay. Both
// allow commercial use without credit in the video; the editor credits the library and each videographer, as both ask.

export type BrollSource = "pexels" | "pixabay";
export const BROLL_SOURCES: Record<BrollSource, { label: string; home: string }> = {
  pexels: { label: "Pexels", home: "https://www.pexels.com" },
  pixabay: { label: "Pixabay", home: "https://pixabay.com" },
};

/**
 * A stock video, as a reel keeps it: its library, the file the render uses (one that fills the reel's frame without
 * being enlarged, when there is one), a lighter one for the editor's preview, its still, the render file's size, the
 * video's length and who made it.
 */
export type BrollClip = { source: BrollSource; id: number; file: string; preview: string; image: string; width: number; height: number; duration: number; author: string; page: string };
/** A shot of B-roll: when it starts (on the recording's clock, like every mark), how long it plays, what found it. */
export type BrollShot = { at: number; length: number; query: string; clip: BrollClip };

export const BROLL_LENGTH = { min: 1.2, max: 5, default: 2.6 } as const;
/** Fade in and out, seconds. */
export const BROLL_FADE = 0.15;
const MAX_SHOTS = 60;

const https = (value: unknown) => {
  try {
    const u = new URL(String(value));
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
};
// Where each library's files, stills and pages live: a reel never fetches anything else.
const HOSTS: Record<BrollSource, { video: (u: URL) => boolean; image: string[]; page: string[] }> = {
  // Older Pexels videos are files on Vimeo's external host.
  pexels: { video: (u) => u.hostname === "videos.pexels.com" || (u.hostname === "player.vimeo.com" && u.pathname.startsWith("/external/")), image: ["images.pexels.com"], page: ["www.pexels.com", "pexels.com"] },
  pixabay: { video: (u) => u.hostname === "cdn.pixabay.com", image: ["cdn.pixabay.com"], page: ["pixabay.com"] },
};
const isVideo = (source: BrollSource, value: unknown) => {
  const u = https(value);
  return u !== null && HOSTS[source].video(u);
};

/** A clip read back defensively: a known library, its own addresses only, sane numbers. Clips saved before there were two libraries are Pexels'. */
export function parseClip(value: unknown): BrollClip | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<BrollClip>;
  const source = v.source === undefined ? "pexels" : v.source;
  if (source !== "pexels" && source !== "pixabay") return null;
  const preview = v.preview ?? v.file;
  const image = https(v.image);
  if (!Number.isInteger(v.id) || !isVideo(source, v.file) || !isVideo(source, preview) || !image || !HOSTS[source].image.includes(image.hostname)) return null;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0);
  const page = https(v.page);
  return {
    source,
    id: v.id as number,
    file: String(v.file),
    preview: String(preview),
    image: image.href,
    width: Math.round(n(v.width)),
    height: Math.round(n(v.height)),
    duration: Math.round(n(v.duration) * 100) / 100,
    author: typeof v.author === "string" ? v.author.slice(0, 80) : "",
    page: page && HOSTS[source].page.includes(page.hostname) ? page.href : BROLL_SOURCES[source].home,
  };
}

/** A reel's B-roll read back defensively: in order, inside the video, each a sane length, never overlapping. */
export function parseBroll(value: unknown, duration: number): BrollShot[] {
  if (!Array.isArray(value)) return [];
  const shots = value
    .map((x) => {
      const s = (x ?? {}) as Partial<BrollShot>;
      const clip = parseClip(s.clip);
      const at = typeof s.at === "number" && Number.isFinite(s.at) ? Math.round(s.at * 1000) / 1000 : -1;
      if (!clip || at < 0 || at >= duration - 0.3) return null;
      // Never longer than the clip, which would end before its fade.
      const most = longestShot(clip);
      if (most < BROLL_LENGTH.min) return null;
      const length = typeof s.length === "number" && Number.isFinite(s.length) ? Math.min(most, Math.max(BROLL_LENGTH.min, Math.round(s.length * 100) / 100)) : Math.min(most, BROLL_LENGTH.default);
      return { at, length, query: typeof s.query === "string" ? s.query.replace(/\s+/g, " ").trim().slice(0, 60) : "", clip };
    })
    .filter((s): s is BrollShot => s !== null)
    .sort((a, b) => a.at - b.at);
  const out: BrollShot[] = [];
  for (const s of shots) {
    const last = out[out.length - 1];
    if (last && s.at < last.at + last.length) continue;
    out.push(s);
  }
  return out.slice(0, MAX_SHOTS);
}

/** How long a shot of this clip can play: up to BROLL_LENGTH.max, and a moment short of the clip's end. */
export const longestShot = (clip: BrollClip) => Math.floor(Math.min(BROLL_LENGTH.max, clip.duration > 0 ? clip.duration - 0.1 : BROLL_LENGTH.max) * 100) / 100;

/** The shot on screen at `t` (an index), or -1. */
export function brollAt(shots: readonly BrollShot[], t: number): number {
  return shots.findIndex((s) => t >= s.at && t < s.at + s.length);
}

/** The same clip (ids are a library's own, so two libraries can share one). */
export const sameClip = (a: BrollClip, b: BrollClip) => a.source === b.source && a.id === b.id;

/* ---------- searching the libraries (the render Worker asks; the runner and the editor get clips) ---------- */

/** A video file a library offers. */
type StockFile = { link: string; width: number; height: number; size?: number };
// The render's frame, and the editor's preview of it (a phone-sized player at twice its pixels, roughly).
const RENDER_SHORT = 1080;
const PREVIEW_SHORT = 540;
const MAX_FILE_BYTES = 250 * 1024 * 1024;

/** How much a file is enlarged to fill a frame (16:9 or 9:16, `short` pixels on its short side): 1 or less is sharp. */
const enlarged = (f: { width: number; height: number }, portrait: boolean, short: number) => {
  const long = (short * 16) / 9;
  return Math.max((portrait ? short : long) / f.width, (portrait ? long : short) / f.height);
};

/** The smallest file that fills the frame without being enlarged; else the biggest there is (files known to be huge left out). */
function pickFile(files: StockFile[], portrait: boolean, short: number): StockFile | null {
  const usable = files.filter((f) => !f.size || f.size <= MAX_FILE_BYTES);
  const bySize = [...usable].sort((a, b) => a.width * a.height - b.width * b.height);
  return bySize.find((f) => enlarged(f, portrait, short) <= 1.02) ?? bySize[bySize.length - 1] ?? null;
}

/** Pexels' video search answer, as much of it as we read. */
export type PexelsVideo = { id: number; width: number; height: number; duration: number; url: string; image: string; user?: { name?: string; url?: string }; video_files?: { link: string; width: number | null; height: number | null; file_type?: string; quality?: string | null }[] };
/** Pixabay's video search answer (a hit), as much of it as we read. */
export type PixabayVideo = { id: number; pageURL: string; duration: number; user?: string; videos?: Partial<Record<"large" | "medium" | "small" | "tiny", { url: string; width: number; height: number; size?: number; thumbnail?: string }>> };

/** A Pexels video as a clip for a reel of this orientation, or null when it has no usable file. */
export function pexelsClip(video: PexelsVideo, portrait: boolean): BrollClip | null {
  const files = (video.video_files ?? []).filter((f) => f.file_type === "video/mp4" && f.width && f.height && isVideo("pexels", f.link)).map((f) => ({ link: f.link, width: f.width!, height: f.height! }));
  const file = pickFile(files, portrait, RENDER_SHORT);
  const preview = pickFile(files, portrait, PREVIEW_SHORT);
  if (!file || !preview) return null;
  return parseClip({ source: "pexels", id: video.id, file: file.link, preview: preview.link, image: video.image, width: file.width, height: file.height, duration: video.duration, author: video.user?.name ?? "", page: video.url });
}

/** A Pixabay video as a clip for a reel of this orientation, or null when it has no usable file. */
export function pixabayClip(video: PixabayVideo, portrait: boolean): BrollClip | null {
  const sizes = Object.values(video.videos ?? {});
  const files = sizes.filter((f) => f && f.url && f.width && f.height && isVideo("pixabay", f.url)).map((f) => ({ link: f!.url, width: f!.width, height: f!.height, size: f!.size }));
  const file = pickFile(files, portrait, RENDER_SHORT);
  const preview = pickFile(files, portrait, PREVIEW_SHORT);
  const image = video.videos?.small?.thumbnail || video.videos?.tiny?.thumbnail || video.videos?.medium?.thumbnail;
  if (!file || !preview || !image) return null;
  return parseClip({ source: "pixabay", id: video.id, file: file.link, preview: preview.link, image, width: file.width, height: file.height, duration: video.duration, author: video.user ?? "", page: video.pageURL });
}

/**
 * A library's video search, without its key (the render Worker adds it: a header for Pexels, `key` in the query for
 * Pixabay). Pexels searches by orientation; Pixabay can't, so it asks for more and stockClips sorts them.
 */
export function stockSearchUrl(source: BrollSource, query: string, portrait: boolean): string {
  return source === "pexels"
    ? `https://api.pexels.com/videos/search?${new URLSearchParams({ query, orientation: portrait ? "portrait" : "landscape", per_page: "15", size: "medium" })}`
    : `https://pixabay.com/api/videos/?${new URLSearchParams({ q: query, video_type: "film", safesearch: "true", per_page: "50" })}`;
}

/**
 * A library's search answer as clips for a reel: long enough to use (3 s and up), best first: the reel's shape and
 * sharp, then sharp after a crop from the other shape (a landscape clip fills a vertical reel from its middle), then
 * the rest; the library's own order within each.
 */
export function stockClips(source: BrollSource, body: unknown, portrait: boolean, max = 12): BrollClip[] {
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((v) => v && typeof v === "object") : []);
  const found =
    source === "pexels"
      ? list((body as { videos?: unknown } | null)?.videos).map((v) => pexelsClip(v as PexelsVideo, portrait))
      : list((body as { hits?: unknown } | null)?.hits).map((v) => pixabayClip(v as PixabayVideo, portrait));
  const clips = found.filter((c): c is BrollClip => c !== null && c.duration >= 3);
  const rank = (c: BrollClip) => (enlarged(c, portrait, RENDER_SHORT) > 1.02 ? 2 : c.height > c.width === portrait ? 0 : 1);
  return [0, 1, 2].flatMap((r) => clips.filter((c) => rank(c) === r)).slice(0, max);
}
