import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@launchreel/core";

/**
 * A Prisma client for the current request. Workers can't share connections across requests,
 * so every request gets its own client; Hyperdrive does the pooling. Falls back to DATABASE_URL
 * when running under plain `next dev` without Cloudflare bindings.
 */
export const getDb = cache(async () => {
  let connectionString = process.env.DATABASE_URL;
  try {
    const { env } = await getCloudflareContext({ async: true });
    connectionString = env.HYPERDRIVE?.connectionString ?? connectionString;
  } catch {
    // Not running on Cloudflare (e.g. a Node script); use DATABASE_URL.
  }
  if (!connectionString) throw new Error("No database: bind HYPERDRIVE or set DATABASE_URL");
  return createDb(connectionString);
});

/** Starts the durable render workflow for a job (render Worker, bound as VIDEO_JOBS). */
export async function startRender(jobId: string) {
  // Local development: `next dev` can't reach another Worker's Workflow through the binding, so it asks the local
  // render Worker to start it. DEV_RENDER_URL and DEV_START_TOKEN only exist in the local .env files.
  if (process.env.NODE_ENV === "development" && process.env.DEV_RENDER_URL) {
    const res = await fetch(`${process.env.DEV_RENDER_URL}/dev/start`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-start-token": process.env.DEV_START_TOKEN ?? "" },
      body: JSON.stringify({ jobId }),
    }).catch(() => null);
    if (!res?.ok) throw new Error("The local render Worker didn't start the job. Is `npm run dev:render` running?");
    return;
  }
  const { env } = await getCloudflareContext({ async: true });
  await env.VIDEO_JOBS.create({ id: jobId, params: { jobId } });
}

/** Starts a re-export of an edited reel: a workflow of its own beside the finished job (exportReel in the render Worker). */
export async function startExport(jobId: string, revision: number) {
  if (process.env.NODE_ENV === "development" && process.env.DEV_RENDER_URL) {
    const res = await fetch(`${process.env.DEV_RENDER_URL}/dev/start`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-start-token": process.env.DEV_START_TOKEN ?? "" },
      body: JSON.stringify({ jobId, export: revision }),
    }).catch(() => null);
    if (!res?.ok) throw new Error("The local render Worker didn't start the export. Is `npm run dev:render` running?");
    return;
  }
  const { env } = await getCloudflareContext({ async: true });
  await env.VIDEO_JOBS.create({ id: `${jobId}-e${revision}`, params: { jobId, export: revision } });
}
