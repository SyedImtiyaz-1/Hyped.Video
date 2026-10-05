// Replaces a model provider's API key everywhere it's used, asked in a hidden macOS dialog so it's never typed into a
// terminal or pasted into a chat: checked with the provider, saved in .env, and uploaded to the render Worker (the only
// place production uses it). Nothing is printed but the outcome.
//
//   npm run openai-key       (Standard videos and reel captions: platform.openai.com → API keys)
//   npm run anthropic-key    (Studio videos: console.anthropic.com → API keys)
//   npm run pexels-key       (stock B-roll in reels: pexels.com/api → Your API key)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PROVIDERS = {
  openai: {
    name: "OPENAI_API_KEY",
    label: "OpenAI",
    where: "platform.openai.com → API keys",
    shape: /^sk-[A-Za-z0-9_-]{20,}$/,
    check: (key) => fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${key}` } }),
  },
  anthropic: {
    name: "ANTHROPIC_API_KEY",
    label: "Anthropic",
    where: "console.anthropic.com → API keys",
    shape: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    check: (key) => fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } }),
  },
  pexels: {
    name: "PEXELS_API_KEY",
    label: "Pexels",
    where: "pexels.com/api → Your API key",
    shape: /^[A-Za-z0-9]{40,64}$/,
    check: (key) => fetch("https://api.pexels.com/videos/search?query=office&per_page=1", { headers: { authorization: key } }),
  },
};

const provider = PROVIDERS[process.argv[2]];
if (!provider) {
  console.log("Usage: node scripts/model-key.mjs openai|anthropic|pexels");
  process.exit(1);
}

const ask = (prompt) => {
  try {
    return execFileSync("osascript", ["-e", `text returned of (display dialog ${JSON.stringify(prompt)} default answer "" with hidden answer with title "Hyped: ${provider.label} key" buttons {"Cancel", "Save"} default button "Save")`], { encoding: "utf8" }).trim();
  } catch {
    console.log("Cancelled; nothing was changed.");
    process.exit(1);
  }
};

let key = ask(`New ${provider.label} API key (${provider.where}).`);
for (let tries = 1; !provider.shape.test(key); tries++) {
  if (tries >= 3) {
    console.log(`That doesn't look like a ${provider.label} API key; nothing was changed.`);
    process.exit(1);
  }
  key = ask(`That doesn't look right. Paste the ${provider.label} API key again.`);
}

const res = await provider.check(key).catch(() => null);
if (!res) {
  console.log(`Couldn't reach ${provider.label} to check the key; nothing was changed. Try again.`);
  process.exit(1);
}
if (!res.ok) {
  console.log(`${provider.label} rejected that key (${res.status}); nothing was changed.`);
  process.exit(1);
}
console.log(`✓ ${provider.label} accepted the key.`);

// .env (git-ignored): replace the line, or add it.
const file = new URL("../.env", import.meta.url);
let text = existsSync(file) ? readFileSync(file, "utf8") : "";
const line = new RegExp(`^[ \\t]*${provider.name}[ \\t]*=.*$`, "m");
text = line.test(text) ? text.replace(line, () => `${provider.name}=${key}`) : `${text.replace(/\n?$/, "\n")}${provider.name}=${key}\n`;
writeFileSync(file, text, { mode: 0o600 });
console.log("✓ Saved in .env.");

// The local render Worker (`wrangler dev`) reads its own copy in render/.dev.vars: keep it in step, if there is one.
const devVars = new URL("../render/.dev.vars", import.meta.url);
if (existsSync(devVars)) {
  const vars = readFileSync(devVars, "utf8");
  writeFileSync(devVars, line.test(vars) ? vars.replace(line, () => `${provider.name}=${key}`) : `${vars.replace(/\n?$/, "\n")}${provider.name}=${key}\n`, { mode: 0o600 });
  console.log("✓ Saved in render/.dev.vars for local renders.");
}

// Production: straight to Wrangler over stdin.
const put = spawnSync("npx", ["wrangler", "secret", "put", provider.name], { cwd: new URL("../render/", import.meta.url), input: key, encoding: "utf8" });
if (put.status !== 0) {
  console.log(`✗ Couldn't upload it to the render Worker. Run \`npm run secrets\` to retry. (${(put.stderr || "").replaceAll(key, "[key]").replace(/sk-[A-Za-z0-9_-]+/g, "[key]").trim().split("\n").pop()})`);
  process.exit(1);
}
console.log(`✓ Live on the render Worker: new videos use it right away.`);
