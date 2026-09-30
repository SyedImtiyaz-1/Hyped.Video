// Builds and deploys the web Worker without shipping local secrets.
//
//   npm run deploy:web                (deploy the render Worker first; after the first deploy, run `npm run secrets`)
//   npm run deploy:web -- --check     build and check the bundle, but don't deploy
//
// OpenNext bundles every value in the repo's .env files into the Worker: the root .env (local model keys, the
// dev bridge token, the dev encryption key) and web/.env.local (Clerk keys) alike. So this script hides those
// files during the build, gives the build and the Worker only public NEXT_PUBLIC_* settings, refuses to deploy
// if anything else ended up in the bundle, and always puts the files back. Secrets reach the Worker only as
// Cloudflare secrets (npm run secrets).
//
// Production-only settings live in web/.env.production.local (git-ignored): the live Clerk keys, so local development
// keeps the dev instance in web/.env.local. Its NEXT_PUBLIC_* values override web/.env.local's, and its
// CLERK_SECRET_KEY is uploaded with the new version itself, so the publishable and secret keys always switch together.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The site's address (the routes in web/wrangler.jsonc). APP_URL=… overrides it, e.g. for a workers.dev-only deploy.
const APP_URL = process.env.APP_URL ?? "https://hyped.video";

const ROOT = new URL("../", import.meta.url);
const WEB = new URL("../web/", import.meta.url);
const ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"].flatMap((f) => [new URL(f, ROOT), new URL(f, WEB)]);
const hidden = (file) => new URL(`${file.href}.deploy-hidden`);

function parse(text) {
  const vars = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars.set(m[1], m[2].replace(/^(['"])(.*)\1$/, "$2"));
  }
  return vars;
}

// Public settings only: Clerk's publishable key and sign-in routes from web/.env.local (overridden by
// web/.env.production.local), plus the app's URL.
const read = (name) => (existsSync(new URL(name, WEB)) ? parse(readFileSync(new URL(name, WEB), "utf8")) : new Map());
const local = read(".env.local");
const production = read(".env.production.local");

// Live Clerk keys are used only once they can work: both keys saved, and Clerk's production domain (inside the
// publishable key) answering, which needs its DNS records and certificate. Until then the dev keys stay, so a deploy
// never breaks sign-in; the first deploy after that switches both keys together.
async function liveClerk() {
  const publishable = production.get("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  if (!publishable?.startsWith("pk_live_")) return null;
  const secret = production.get("CLERK_SECRET_KEY");
  if (!secret?.startsWith("sk_live_")) return (console.log("Clerk production: no live secret key yet (npm run clerk); deploying with the development keys."), null);
  const host = Buffer.from(publishable.slice("pk_live_".length), "base64").toString("utf8").replace(/\$$/, "");
  // A real answer from Clerk is JSON; Cloudflare's error pages (e.g. while Clerk is still verifying) are HTML.
  const ok = await fetch(`https://${host}/v1/environment`, { headers: { origin: APP_URL }, signal: AbortSignal.timeout(10_000) })
    .then((r) => r.ok && (r.headers.get("content-type") ?? "").includes("json"))
    .catch(() => false);
  if (!ok) return (console.log(`Clerk production: ${host} isn't answering yet (add Clerk's DNS records in Cloudflare, DNS only, and let Clerk verify them); deploying with the development keys.`), null);
  return { publishable, secret };
}
const live = await liveClerk();

const publicEnv = {};
for (const [k, v] of local) if (k.startsWith("NEXT_PUBLIC_") && v) publicEnv[k] = v;
if (live) for (const [k, v] of production) if (k.startsWith("NEXT_PUBLIC_") && v) publicEnv[k] = v;
publicEnv.NEXT_PUBLIC_APP_URL = APP_URL;
if (!publicEnv.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
  console.error("No NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in web/.env.local; nothing deployed.");
  process.exit(1);
}
const liveSecret = live?.secret;
if (live) console.log("Clerk production: using the live keys (the secret key is uploaded with this version).");

const restore = () => {
  for (const file of ENV_FILES) if (existsSync(hidden(file))) renameSync(hidden(file), file);
};
restore(); // a previous run that was killed may have left files hidden
process.on("SIGINT", () => (restore(), process.exit(130)));
process.on("SIGTERM", () => (restore(), process.exit(143)));

const npx = (args, env = {}) => spawnSync("npx", args, { cwd: WEB, stdio: "inherit", env: { ...process.env, ...env } }).status === 0;

let built;
for (const file of ENV_FILES) if (existsSync(file)) renameSync(file, hidden(file));
try {
  built = npx(["opennextjs-cloudflare", "build"], publicEnv);
} finally {
  restore();
}
if (!built) {
  console.error("\nBuild failed; nothing deployed.");
  process.exit(1);
}

// The bundle may carry public settings only.
const bundled = await import(`${new URL(".open-next/cloudflare/next-env.mjs", WEB).href}?t=${Date.now()}`);
const leaked = [...new Set(Object.values(bundled).flatMap((vars) => Object.keys(vars ?? {})))].filter((k) => !k.startsWith("NEXT_PUBLIC_"));
if (leaked.length) {
  console.error(`\nRefusing to deploy: the bundle contains ${leaked.join(", ")}.`);
  process.exit(1);
}

if (process.argv.includes("--check")) {
  console.log("\nBundle checked: public settings only. Not deployed (--check).");
  process.exit(0);
}

// The same public settings as Worker vars, for code that reads them at runtime rather than at build time.
const vars = Object.entries(publicEnv).flatMap(([k, v]) => ["--var", `${k}:${v}`]);
// The live Clerk secret goes up with this version, from a private temp file that's deleted straight after.
const secretsDir = liveSecret ? mkdtempSync(join(tmpdir(), "hyped-deploy-")) : null;
const secretsArgs = [];
if (secretsDir) {
  writeFileSync(join(secretsDir, "secrets.json"), JSON.stringify({ CLERK_SECRET_KEY: liveSecret }), { mode: 0o600 });
  secretsArgs.push("--secrets-file", join(secretsDir, "secrets.json"));
}
let deployed;
try {
  deployed = npx(["opennextjs-cloudflare", "deploy", "--", ...vars, ...secretsArgs]);
} finally {
  if (secretsDir) rmSync(secretsDir, { recursive: true, force: true });
}
if (!deployed) process.exit(1);
console.log(`\nDeployed ${APP_URL}. First deploy? Run \`npm run secrets\` to give it its secrets.`);
