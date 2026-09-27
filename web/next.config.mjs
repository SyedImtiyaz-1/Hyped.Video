import nextEnv from "@next/env"; // CommonJS: no named ESM exports
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// One .env at the repo root serves the web app and the worker (Next.js would only read web/.env).
nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), ".."));

// Gives `next dev` the Cloudflare bindings from wrangler.jsonc (Hyperdrive, workflows).
// Demo mode never touches bindings, so it skips this and starts faster.
if (process.env.DEMO_MODE !== "true") initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@launchreel/core"],
  // .prisma/client too: OpenNext must copy it with its "workerd" (WASM) build, or Prisma fails on Workers.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  devIndicators: { position: "bottom-right" }, // keep the dev badge off the sidebar
};
