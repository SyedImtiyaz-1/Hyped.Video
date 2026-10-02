// The reel editor's files in R2, written by the render Worker after a reel renders: jobs/<id>/edit.json (the reel's
// decisions, a ReelEdit) and jobs/<id>/preview.mp4 (a small clean copy, no captions, to preview edits on). Both are
// private: only the owner-checked routes under /api/reels/[id] read them. Demo mode uses a sample instead.
import { parseReelEdit, type ReelEdit } from "@launchreel/core/reel";
import { isDemo } from "./demo";
import demoEdit from "./demo-edit.json";
import { videoBucket } from "./reel-uploads";

export const editKey = (jobId: string) => `jobs/${jobId}/edit.json`;
export const previewKey = (jobId: string) => `jobs/${jobId}/preview.mp4`;
/** The demo's preview (public/reels): a sample reel without captions. */
export const DEMO_PREVIEW = "/reels/demo-preview.mp4";

// Local `next dev` has an R2 of its own that the render Worker can't see, so there these files go through the render
// Worker's dev routes (devFiles in render/src/index.ts), like uploads do.
const dev = process.env.NODE_ENV === "development" && process.env.DEV_RENDER_URL ? { base: process.env.DEV_RENDER_URL, token: process.env.DEV_START_TOKEN ?? "" } : null;
const devFile = (key: string, init: RequestInit = {}) => fetch(`${dev!.base}/dev/files/${key}`, { ...init, headers: { ...init.headers, "x-dev-start-token": dev!.token } });

/** A reel's saved decisions, or null (reels made before editing existed have none). */
export async function readEdit(jobId: string): Promise<ReelEdit | null> {
  if (isDemo) return parseReelEdit(demoEdit);
  if (dev) {
    const res = await devFile(editKey(jobId));
    return res.ok ? parseReelEdit(await res.json()) : null;
  }
  const object = await (await videoBucket()).get(editKey(jobId));
  return object ? parseReelEdit(JSON.parse(await object.text())) : null;
}

export async function writeEdit(jobId: string, edit: ReelEdit) {
  if (dev) {
    const res = await devFile(editKey(jobId), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(edit) });
    if (!res.ok) throw new Error(`The local render Worker didn't save the edit (${res.status})`);
    return;
  }
  await (await videoBucket()).put(editKey(jobId), JSON.stringify(edit), { httpMetadata: { contentType: "application/json" } });
}

/** A reel's clean preview as a response (whole, or the range the request asks for), or null when there's none. */
export async function previewResponse(jobId: string, request: Request): Promise<Response | null> {
  const headers = new Headers({ "content-type": "video/mp4", "accept-ranges": "bytes", "cache-control": "private, max-age=3600" });
  if (dev) {
    const res = await devFile(previewKey(jobId), { headers: request.headers.has("range") ? { range: request.headers.get("range")! } : {} });
    if (!res.ok) return null;
    for (const name of ["content-range", "content-length", "etag"]) if (res.headers.has(name)) headers.set(name, res.headers.get(name)!);
    return new Response(res.body, { status: res.status, headers });
  }
  const object = await (await videoBucket()).get(previewKey(jobId), { range: request.headers });
  if (!object) return null;
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  const offset = object.range?.offset;
  if (request.headers.has("range") && offset !== undefined) {
    const length = object.range?.length ?? object.size - offset;
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}
