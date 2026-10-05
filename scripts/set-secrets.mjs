// Copies secrets from the local env files into the deployed Workers' Cloudflare secrets. Values go straight
// from the file to Wrangler over stdin: never printed, never written anywhere else. Anything missing is skipped.
//
//   npm run secrets        (after both Workers' first deploy; `npm run keys` checks the model keys first)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function parse(file) {
  const vars = new Map();
  const url = new URL(`../${file}`, import.meta.url);
  if (!existsSync(url)) return vars;
  for (const line of readFileSync(url, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars.set(m[1], m[2].replace(/^(['"])(.*)\1$/, "$2"));
  }
  return vars;
}

const files = { ".env": parse(".env"), "web/.env.local": parse("web/.env.local"), "web/.env.production.local": parse("web/.env.production.local") };
const SECRETS = [
  // render Worker: the model keys, used only by its egress handlers (never inside the container)
  { worker: "render", name: "OPENAI_API_KEY", from: ".env", why: "Standard videos" },
  { worker: "render", name: "ANTHROPIC_API_KEY", from: ".env", why: "Studio videos" },
  { worker: "render", name: "PEXELS_API_KEY", from: ".env", why: "stock B-roll in reels" },
  // web Worker
  // Once a live Clerk key is saved (web/.env.production.local), npm run deploy:web owns CLERK_SECRET_KEY: it uploads the
  // live key together with the live publishable key. So this skips it, and never switches one key without the other.
  ...(files["web/.env.production.local"].get("CLERK_SECRET_KEY") ? [] : [{ worker: "web", name: "CLERK_SECRET_KEY", from: "web/.env.local", why: "sign-in" }]),
  { worker: "web", name: "ADMIN_USER_IDS", from: ".env", why: "the admin page" },
  { worker: "web", name: "DODO_PAYMENTS_API_KEY", from: ".env", why: "checkout" },
  { worker: "web", name: "DODO_PAYMENTS_WEBHOOK_KEY", from: ".env", why: "payment webhooks" },
  { worker: "web", name: "DODO_PAYMENTS_ENVIRONMENT", from: ".env", why: "test or live payments" },
  { worker: "web", name: "DODO_PRODUCT_STARTER", from: ".env", why: "the Starter pack" },
  { worker: "web", name: "DODO_PRODUCT_CREATOR", from: ".env", why: "the Creator pack" },
  { worker: "web", name: "DODO_PRODUCT_PRO", from: ".env", why: "the Pro pack" },
  { worker: "web", name: "DODO_PRODUCT_REELS", from: ".env", why: "the Reel pack" },
];

let failed = false;
for (const { worker, name, from, why } of SECRETS) {
  const value = files[from].get(name);
  if (!value) {
    console.log(`- ${name} (${why}): not in ${from}, skipped`);
    continue;
  }
  const run = spawnSync("npx", ["wrangler", "secret", "put", name], {
    cwd: new URL(`../${worker}/`, import.meta.url),
    input: value,
    stdio: ["pipe", "ignore", "pipe"],
  });
  if (run.status === 0) console.log(`✓ ${name} (${why}) saved on the ${worker} Worker`);
  else {
    failed = true;
    const err = String(run.stderr).replace(/\b(?:sk|pk|rk)[-_][A-Za-z0-9_*.-]{4,}/g, "[key]").trim().split("\n").slice(-2).join(" ");
    console.log(`✗ ${name} (${why}) failed: ${err}`);
  }
}
process.exit(failed ? 1 : 0);
