// Checks the model API keys in the root .env, then copies them into render/.dev.vars so the local
// render Worker (`wrangler dev`) uses the same keys. Edit only .env. Keys are never printed.
//
//   npm run keys
//
// Each key gets one tiny request (well under $0.001) to the model the product uses, so "works" means
// the key is valid, has credit and can use that model.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_FILE = new URL("../.env", import.meta.url);
const DEV_VARS = new URL("../render/.dev.vars", import.meta.url);

const PROVIDERS = {
  ANTHROPIC_API_KEY: {
    label: "Anthropic (Claude)",
    model: "claude-sonnet-5",
    keysUrl: "https://console.anthropic.com/settings/keys",
    billingUrl: "https://console.anthropic.com/settings/billing",
    request: (key, model) =>
      fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      }),
  },
  OPENAI_API_KEY: {
    label: "OpenAI",
    model: "gpt-6-sol",
    keysUrl: "https://platform.openai.com/api-keys",
    billingUrl: "https://platform.openai.com/settings/organization/billing",
    request: (key, model) =>
      fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ model, input: "hi", max_output_tokens: 16 }),
      }),
  },
};

function parse(text) {
  const vars = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars.set(m[1], m[2].replace(/^(['"])(.*)\1$/, "$2"));
  }
  return vars;
}

// Provider messages can echo part of the key (OpenAI does); never let that reach the terminal.
const redact = (text) => String(text ?? "").replace(/sk-[A-Za-z0-9_*.-]{4,}/g, "sk-…").slice(0, 200);

async function check(p, key) {
  let res;
  try {
    res = await p.request(key, p.model);
  } catch (err) {
    return { ok: false, why: `couldn't reach the API (${err.cause?.code ?? err.message}). Check your internet connection.` };
  }
  if (res.ok) return { ok: true, why: `works (valid key, has credit, can use ${p.model})` };
  const body = await res.json().catch(() => ({}));
  const message = body?.error?.message ?? "";
  const code = body?.error?.code ?? body?.error?.type ?? "";
  if (res.status === 401) return { ok: false, why: `REJECTED: the key is wrong, deleted or disabled. Create a new one at ${p.keysUrl}` };
  if (/credit balance|insufficient_quota|billing/i.test(`${message} ${code}`)) return { ok: false, why: `NO CREDIT: the key is valid but the account has no credit. Add some at ${p.billingUrl}` };
  if (res.status === 403) return { ok: false, why: `NOT ALLOWED: the key can't use ${p.model} (${redact(message)})` };
  if (res.status === 404) return { ok: false, why: `MODEL NOT AVAILABLE: this account can't use ${p.model} yet (${redact(message)})` };
  if (res.status === 429) return { ok: false, why: `RATE LIMITED: try again in a minute (${redact(message)})` };
  return { ok: false, why: `error ${res.status}: ${redact(message) || "unknown"}` };
}

if (!existsSync(ENV_FILE)) {
  console.log("No .env file at the repo root. Create it with: cp .env.example .env");
  process.exit(1);
}
const env = parse(readFileSync(ENV_FILE, "utf8"));

console.log("Checking the keys in .env ...\n");
const working = [];
for (const [name, p] of Object.entries(PROVIDERS)) {
  const key = env.get(name) ?? "";
  if (!key) {
    console.log(`  ${p.label.padEnd(20)} not set. Add ${name}=... to .env (get a key at ${p.keysUrl})`);
    continue;
  }
  const result = await check(p, key);
  if (result.ok) working.push(name);
  console.log(`  ${p.label.padEnd(20)} ${result.ok ? "✓" : "✗"} ${result.why}`);
}

// Keep render/.dev.vars in step with .env: replace our keys, keep any other lines as they are.
// A key that is empty in .env but set in .dev.vars is kept, never wiped.
const before = existsSync(DEV_VARS) ? readFileSync(DEV_VARS, "utf8") : "";
const devVars = parse(before);
const names = Object.keys(PROVIDERS);
const kept = before.split(/\r?\n/).filter((l) => {
  const t = l.trim();
  return t && !t.startsWith("# Local secrets for `wrangler dev`") && !t.startsWith("# Keys are copied here") && !names.some((n) => t.startsWith(`${n}=`));
});
const after = [
  "# Local secrets for `wrangler dev` (git-ignored).",
  "# Keys are copied here from the root .env by `npm run keys`. Edit the .env, not this file.",
  ...kept,
  ...names.map((n) => `${n}=${env.get(n) || devVars.get(n) || ""}`),
].join("\n") + "\n";
if (after !== before) {
  writeFileSync(DEV_VARS, after);
  console.log("\nCopied the keys into render/.dev.vars (restart `npm run dev:render` if it's running).");
}

console.log("");
const engine = env.get("ENGINE") === "openai" ? "openai" : "claude";
const engineKey = engine === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
const label = { openai: "OpenAI", claude: "Claude" };
if (working.includes(engineKey)) {
  console.log(`Ready on ${label[engine]} (ENGINE=${engine} in .env). Make a video with:`);
  console.log("  npm run measure -- https://yourproduct.com                  (20s teaser)");
  console.log("  npm run measure -- --duration 90 https://yourproduct.com    (90s launch video)");
} else if (working.length) {
  const other = working.includes("OPENAI_API_KEY") ? "openai" : "claude";
  console.log(`ENGINE=${engine} in .env has no working key, but ${label[other]} works. Set ENGINE=${other} in .env, then: npm run measure -- https://yourproduct.com`);
} else {
  console.log("No working key yet. Fix the key above, save .env (Cmd+S), then run: npm run keys");
  process.exitCode = 1;
}
