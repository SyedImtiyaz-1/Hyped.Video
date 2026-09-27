// Bindings from wrangler.jsonc, typed to what the app uses (merged into OpenNext's CloudflareEnv).
interface CloudflareEnv {
  HYPERDRIVE: { connectionString: string };
  VIDEO_JOBS: { create(options: { id?: string; params?: { jobId: string } }): Promise<unknown> };
}
