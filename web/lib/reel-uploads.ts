// Reel uploads: the browser sends its video in REEL_PART_BYTES parts and each part goes straight into R2 as a multipart
// upload, through this Worker's VIDEOS binding. There are no S3 credentials, and a Worker takes at most 100 MB a
// request. Local `next dev` has an R2 of its own that the render Worker can't see, so there the parts go through the
// render Worker's dev routes into its bucket instead (devUploads in render/src/index.ts).
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { REEL_UPLOAD_TYPES, type ReelUploadType } from "@launchreel/core/reel";

export type UploadedPart = { partNumber: number; etag: string };

/** The R2 calls reel uploads make (the web app doesn't carry the Workers types). */
type Bucket = {
  createMultipartUpload(key: string, options?: { httpMetadata?: { contentType?: string } }): Promise<{ uploadId: string }>;
  resumeMultipartUpload(key: string, uploadId: string): { uploadPart(partNumber: number, body: ArrayBuffer): Promise<UploadedPart>; complete(parts: UploadedPart[]): Promise<{ size: number }>; abort(): Promise<void> };
  get(key: string, options: { range: { offset: number; length: number } }): Promise<{ size: number; httpMetadata?: { contentType?: string }; arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
};

declare global {
  interface CloudflareEnv {
    VIDEOS?: Bucket;
  }
}

export type UploadStore = {
  create(key: string, contentType: string): Promise<string>;
  part(key: string, uploadId: string, partNumber: number, body: ArrayBuffer): Promise<UploadedPart>;
  complete(key: string, uploadId: string, parts: UploadedPart[]): Promise<number>;
  abort(key: string, uploadId: string): Promise<void>;
  /** Size, type and the first 16 bytes (hex) of a finished upload, or null. */
  head(key: string): Promise<{ size: number; contentType: string | null; start: string } | null>;
  remove(key: string): Promise<void>;
};

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

function r2Store(bucket: Bucket): UploadStore {
  return {
    create: async (key, contentType) => (await bucket.createMultipartUpload(key, { httpMetadata: { contentType } })).uploadId,
    part: (key, uploadId, partNumber, body) => bucket.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, body),
    complete: async (key, uploadId, parts) => (await bucket.resumeMultipartUpload(key, uploadId).complete(parts)).size,
    abort: (key, uploadId) => bucket.resumeMultipartUpload(key, uploadId).abort(),
    head: async (key) => {
      const object = await bucket.get(key, { range: { offset: 0, length: 16 } });
      return object ? { size: object.size, contentType: object.httpMetadata?.contentType ?? null, start: hex(await object.arrayBuffer()) } : null;
    },
    remove: (key) => bucket.delete(key),
  };
}

function devStore(base: string, token: string): UploadStore {
  const call = async <T>(op: string, init: { query?: Record<string, string>; json?: object; body?: ArrayBuffer }): Promise<T | null> => {
    const url = `${base}/dev/uploads/${op}${init.query ? `?${new URLSearchParams(init.query)}` : ""}`;
    const res = await fetch(url, {
      method: init.body ? "PUT" : init.json ? "POST" : "GET",
      headers: { "x-dev-start-token": token, ...(init.json ? { "content-type": "application/json" } : {}) },
      body: init.body ?? (init.json ? JSON.stringify(init.json) : undefined),
    }).catch(() => null);
    if (res?.status === 404 && op === "head") return null;
    if (!res?.ok) throw new Error(`The local render Worker didn't take the upload (${op}: ${res?.status ?? "no answer"}). Is \`npm run dev:render\` running?`);
    return (await res.json()) as T;
  };
  return {
    create: async (key, contentType) => (await call<{ uploadId: string }>("create", { json: { key, contentType } }))!.uploadId,
    part: async (key, uploadId, partNumber, body) => (await call<UploadedPart>("part", { query: { key, uploadId, part: String(partNumber) }, body }))!,
    complete: async (key, uploadId, parts) => (await call<{ size: number }>("complete", { json: { key, uploadId, parts } }))!.size,
    abort: async (key, uploadId) => void (await call("abort", { json: { key, uploadId } })),
    head: (key) => call<{ size: number; contentType: string | null; start: string }>("head", { query: { key } }),
    remove: async (key) => void (await call("delete", { json: { key } })),
  };
}

export async function uploadStore(): Promise<UploadStore> {
  // DEV_RENDER_URL and DEV_START_TOKEN only exist in the local .env files (see startRender in lib/db.ts).
  if (process.env.NODE_ENV === "development" && process.env.DEV_RENDER_URL) return devStore(process.env.DEV_RENDER_URL, process.env.DEV_START_TOKEN ?? "");
  const { env } = await getCloudflareContext({ async: true });
  if (!env.VIDEOS) throw new Error("The VIDEOS bucket isn't bound to the web Worker");
  return r2Store(env.VIDEOS);
}

/** A new upload's key: uploads/<userId>/<random>.<ext>. */
export const newUploadKey = (userId: string, contentType: ReelUploadType) => `uploads/${userId}/${crypto.randomUUID()}.${REEL_UPLOAD_TYPES[contentType]}`;

/** Every upload call checks this, so nobody can touch someone else's file. */
export function ownsUploadKey(userId: string, key: string): boolean {
  const [folder, owner, name, ...rest] = key.split("/");
  return folder === "uploads" && owner === userId && !rest.length && /^[0-9a-f-]{36}\.(mp4|mov|webm)$/.test(name ?? "");
}

/** Whether a file starts like an MP4 or QuickTime file (an ISO box: ftyp, moov, mdat…) or a WebM (EBML) file. */
export function looksLikeVideo(start: string): boolean {
  if (start.startsWith("1a45dfa3")) return true;
  const box = String.fromCharCode(...(start.slice(8, 16).match(/../g) ?? []).map((b) => parseInt(b, 16)));
  return ["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(box);
}
