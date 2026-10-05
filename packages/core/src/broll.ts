// Stock B-roll: short clips laid over the speaker while they keep talking (the voice and the captions carry on), found
// on Pexels from a search the planner writes for the moment ("typing on a laptop"), or picked in the editor. Pexels
// footage is free to use without attribution in the video; the editor credits Pexels and each videographer.

/** A Pexels video, as a reel keeps it: the file it plays, its still, size, length and who made it. */
export type BrollClip = { id: number; file: string; image: string; width: number; height: number; duration: number; author: string; page: string };
/** A shot of B-roll: when it starts (on the recording's clock, like every mark), how long it plays, what found it. */
export type BrollShot = { at: number; length: number; query: string; clip: BrollClip };

export const BROLL_LENGTH = { min: 1.2, max: 5, default: 2.6 } as const;
/** Fade in and out, seconds. */
export const BROLL_FADE = 0.15;
const MAX_SHOTS = 60;

const hostIs = (url: unknown, hosts: string[]) => {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" && hosts.includes(u.hostname);
  } catch {
    return false;
  }
};
const VIDEO_HOSTS = ["videos.pexels.com", "player.vimeo.com"];
const IMAGE_HOSTS = ["images.pexels.com"];
const PAGE_HOSTS = ["www.pexels.com", "pexels.com"];
/** A Pexels video file: on its own host, or (older videos) Vimeo's external files that Pexels links to. */
const isVideoFile = (url: unknown) => hostIs(url, VIDEO_HOSTS) && (new URL(String(url)).hostname !== "player.vimeo.com" || new URL(String(url)).pathname.startsWith("/external/"));

/** A clip read back defensively: Pexels addresses only (so a reel never fetches anything else), sane numbers. */
export function parseClip(value: unknown): BrollClip | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<BrollClip>;
  if (!Number.isInteger(v.id) || !isVideoFile(v.file) || !hostIs(v.image, IMAGE_HOSTS)) return null;
  const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : 0);
  return {
    id: v.id as number,
    file: String(v.file),
    image: String(v.image),
    width: Math.round(n(v.width)),
    height: Math.round(n(v.height)),
    duration: Math.round(n(v.duration) * 100) / 100,
    author: typeof v.author === "string" ? v.author.slice(0, 80) : "",
    page: hostIs(v.page, PAGE_HOSTS) ? String(v.page) : "https://www.pexels.com",
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

/** Pexels' video search answer, as much of it as we read. */
export type PexelsVideo = { id: number; width: number; height: number; duration: number; url: string; image: string; user?: { name?: string; url?: string }; video_files?: { link: string; width: number | null; height: number | null; file_type?: string; quality?: string | null }[] };

/**
 * A Pexels video as a clip: its MP4 closest to a reel's frame (the largest up to 1200 on the short side, so 1080p when
 * there is one; else the smallest above that; else the largest there is), or null when it has none. Searches ask Pexels
 * for the reel's orientation; a clip of the other shape still works (the render crops it to fill the frame).
 */
export function pexelsClip(video: PexelsVideo): BrollClip | null {
  const files = (video.video_files ?? []).filter((f) => f.file_type === "video/mp4" && f.width && f.height && isVideoFile(f.link));
  if (!files.length) return null;
  const short = (f: { width: number | null; height: number | null }) => Math.min(f.width ?? 0, f.height ?? 0);
  const bySize = [...files].sort((a, b) => short(a) - short(b));
  const file = [...bySize].reverse().find((f) => short(f) <= 1200 && short(f) >= 720) ?? bySize.find((f) => short(f) > 1200) ?? bySize[bySize.length - 1];
  return parseClip({ id: video.id, file: file.link, image: video.image, width: file.width, height: file.height, duration: video.duration, author: video.user?.name ?? "", page: video.url });
}
