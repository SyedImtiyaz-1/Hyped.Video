// Saves the Dodo Payments settings and gives them to the live site. Each value is asked in a macOS dialog (the two
// secrets hidden), so nothing is typed into a terminal or pasted into a chat. Leave a dialog empty to keep the value
// that's already there. Values go into .env (git-ignored), then to the web Worker as Cloudflare secrets in one upload.
//
//   npm run dodo        (Dodo dashboard: Developer → API Keys, Developer → Webhooks, and Products)
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const ENV = new URL("../.env", import.meta.url);
const WEB = new URL("../web/", import.meta.url);

// Formats aren't documented, so only catch values pasted into the wrong box.
const secret = (v) => (/\s/.test(v) ? "it has spaces in it" : /^https?:/i.test(v) ? "that's a web address" : /^pdt_/.test(v) ? "that's a product ID" : v.length < 16 ? "it's too short" : null);
const product = (v) => (/^pdt_[A-Za-z0-9]+$/.test(v) ? null : "product IDs look like pdt_ followed by letters and numbers");
const FIELDS = [
  { name: "DODO_PAYMENTS_API_KEY", hidden: true, ask: "Dodo API key (Developer → API Keys).", check: (v) => secret(v) ?? (/^whsec_/.test(v) ? "that's the webhook secret" : null) },
  { name: "DODO_PAYMENTS_WEBHOOK_KEY", hidden: true, ask: "Webhook signing secret (Developer → Webhooks → your endpoint → Overview).", check: secret },
  { name: "DODO_PRODUCT_STARTER", ask: "Product ID of the Starter pack (Products → the product → its ID, pdt_…).", check: product },
  { name: "DODO_PRODUCT_CREATOR", ask: "Product ID of the Creator pack (pdt_…).", check: product },
  { name: "DODO_PRODUCT_PRO", ask: "Product ID of the Pro pack (pdt_…).", check: product },
];

let text = readFileSync(ENV, "utf8");
// [ \t], never \s: \s matches line breaks, so an empty NAME= line would read the next line as its value.
const current = (name) => text.match(new RegExp(`^[ \\t]*${name}[ \\t]*=[ \\t]*(.*?)[ \\t]*$`, "m"))?.[1].replace(/^(['"])(.*)\1$/, "$2") ?? "";
const osa = (script) => execFileSync("osascript", ["-e", script], { encoding: "utf8" }).trim();

function ask(field, last) {
  const prompt = field.ask + (current(field.name) ? "\n\nAlready set: leave empty to keep it." : "");
  const button = last ? "Save" : "Next";
  try {
    return osa(`text returned of (display dialog ${JSON.stringify(prompt)} default answer "" ${field.hidden ? "with hidden answer " : ""}with title "Hyped: Dodo Payments" buttons {"Cancel", "${button}"} default button "${button}")`);
  } catch {
    console.log("Cancelled; nothing was changed.");
    process.exit(1);
  }
}

const changed = new Map();
FIELDS.forEach((field, i) => {
  for (;;) {
    const value = ask(field, i === FIELDS.length - 1);
    if (!value) return; // keep what's there
    const problem = field.check(value);
    if (!problem) return void changed.set(field.name, value);
    spawnSync("osascript", ["-e", `display alert ${JSON.stringify(`That doesn't look right: ${problem}.`)} message "Copy it again from the Dodo dashboard." as warning`]);
  }
});
if (!changed.size) {
  console.log("Nothing entered; nothing was changed.");
  process.exit(0);
}

// Into .env: replace the line if it's there, otherwise add it.
for (const [name, value] of changed) {
  const line = new RegExp(`^[ \\t]*${name}[ \\t]*=.*$`, "m");
  text = line.test(text) ? text.replace(line, () => `${name}=${value}`) : `${text.replace(/\n?$/, "\n")}${name}=${value}\n`;
}
writeFileSync(ENV, text);
for (const name of changed.keys()) console.log(`✓ ${name} saved in .env`);

// Every Dodo setting that has a value goes to the live site, in one upload (one new Worker version).
const all = Object.fromEntries(["DODO_PAYMENTS_ENVIRONMENT", ...FIELDS.map((f) => f.name)].map((n) => [n, current(n)]).filter(([, v]) => v));
const run = spawnSync("npx", ["wrangler", "secret", "bulk"], { cwd: WEB, input: JSON.stringify(all), encoding: "utf8" });
if (run.status !== 0) {
  const scrub = (s) => Object.values(all).reduce((out, v) => out.split(v).join("[hidden]"), String(s ?? ""));
  console.log(`✗ Couldn't update the live site: ${scrub(run.stderr || run.stdout).trim().split("\n").slice(-3).join(" ")}`);
  console.log("The values are saved in .env; run `npm run dodo` or `npm run secrets` again to retry.");
  process.exit(1);
}
for (const name of Object.keys(all)) console.log(`✓ ${name} is on the live site`);
const missing = FIELDS.map((f) => f.name).filter((n) => !all[n]);
if (missing.length) console.log(`\nStill empty: ${missing.join(", ")}. Run \`npm run dodo\` again when you have them.`);
else console.log("\nPayments are set up. Test one: Billing → buy a pack → card 4242 4242 4242 4242, 06/32, CVC 123.");
