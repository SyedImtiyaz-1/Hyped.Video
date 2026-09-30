import nextEnv from "@next/env"; // CommonJS: no named ESM exports
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// In development, one .env at the repo root serves the web app and the worker (Next.js would only read web/.env).
// Never in a production build: OpenNext bundles every loaded env value into the Worker, and the root .env holds
// local secrets (model API keys, the dev bridge token, the dev encryption key). Production config comes from
// wrangler.jsonc vars, Worker secrets and the build command's environment.
if (process.env.NODE_ENV !== "production") nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), ".."));

// Gives `next dev` the Cloudflare bindings from wrangler.jsonc (Hyperdrive, workflows).
// Demo mode never touches bindings, so it skips this and starts faster.
if (process.env.DEMO_MODE !== "true") initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
export default {
  // The demo gets its own build folder, so `npm run demo` and the real app can run side by side
  // (two `next dev` servers sharing .next overwrite each other's output and break pages).
  distDir: process.env.DEMO_MODE === "true" ? ".next-demo" : ".next",
  transpilePackages: ["@launchreel/core"],
  // .prisma/client too: OpenNext must copy it with its "workerd" (WASM) build, or Prisma fails on Workers.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  devIndicators: { position: "bottom-right" }, // keep the dev badge off the sidebar
};
