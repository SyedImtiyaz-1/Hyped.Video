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
  const { env } = await getCloudflareContext({ async: true });
  await env.VIDEO_JOBS.create({ id: jobId, params: { jobId } });
}
