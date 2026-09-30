// Makes the Dodo products match PACKS in packages/core/src/pricing.ts: each pack's name, description and USD price, and
// India's fixed rupee price (Localized Pricing by billing country). Prices are tax-inclusive, so what the site shows is
// exactly what the customer pays. Products are updated in place, so their IDs (DODO_PRODUCT_* in .env) never change.
// Prints no secrets.
//
//   npm run dodo:sync                 shows what would change
//   npm run dodo:sync -- --apply      changes it
import { readFileSync } from "node:fs";
import DodoPayments from "dodopayments";
import { PACKS, QUALITY_CREDIT_MULTIPLIER } from "../packages/core/src/pricing.ts";

const apply = process.argv.includes("--apply");
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .map((l) => l.match(/^[ \t]*([A-Z0-9_]+)[ \t]*=[ \t]*(.*?)[ \t]*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, "$2")]),
);
const client = new DodoPayments({ bearerToken: env.DODO_PAYMENTS_API_KEY, environment: env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode" });
const hide = (s) => String(s ?? "").split(env.DODO_PAYMENTS_API_KEY || "\0").join("[hidden]");
console.log(`Dodo ${env.DODO_PAYMENTS_ENVIRONMENT}${apply ? "" : " (dry run: add --apply to change anything)"}\n`);

let changes = 0;
const change = async (what, fn) => {
  changes++;
  console.log(`  ${apply ? "✓" : "→"} ${what}`);
  if (apply) await fn();
};

for (const [key, pack] of Object.entries(PACKS)) {
  const id = env[`DODO_PRODUCT_${key}`];
  if (!id) {
    console.log(`${pack.name}: no DODO_PRODUCT_${key} in .env; skipped`);
    continue;
  }
  const studio = Math.floor(pack.credits / QUALITY_CREDIT_MULTIPLIER.studio);
  const want = {
    name: `Hyped – ${pack.name} (${pack.credits} credits)`,
    description: `${pack.credits} Hyped credits${pack.bonus ? ` (${pack.credits - pack.bonus} + ${pack.bonus} bonus)` : ""}: up to ${pack.credits} short launch videos (Standard, up to 30 seconds), or ${studio} in Studio. Credits never expire.`,
    cents: pack.priceUsd * 100,
    paise: pack.priceInr * 100, // tax-inclusive, like the USD price
  };
  try {
    const p = await client.products.retrieve(id);
    console.log(`${pack.name} (${id}): now "${p.name}", ${p.price.price / 100} ${p.price.currency}`);
    if (p.name !== want.name || p.description !== want.description || p.price.price !== want.cents || p.price.currency !== "USD" || !p.price.tax_inclusive || p.pricing_mode !== "by_country") {
      await change(`set "${want.name}", $${pack.priceUsd} tax included, India priced by country`, () =>
        client.products.update(id, {
          name: want.name,
          description: want.description,
          metadata: { pack: key },
          pricing_mode: "by_country",
          price: { type: "one_time_price", price: want.cents, currency: "USD", discount: 0, purchasing_power_parity: false, tax_inclusive: true },
        }),
      );
    }
    const rules = (await client.products.localizedPrices.list(id)).items;
    const india = rules.find((r) => r.country_code === "IN");
    const label = `India: ₹${pack.priceInr}, GST included`;
    if (!india) await change(label, () => client.products.localizedPrices.create(id, { amount: want.paise, currency: "INR", country_code: "IN" }));
    else if (india.amount !== want.paise || india.currency !== "INR") await change(`${label} (was ${india.amount / 100} ${india.currency})`, () => client.products.localizedPrices.update(india.id, { product_id: id, amount: want.paise }));
  } catch (e) {
    console.log(`  ✗ ${pack.name}: ${hide(e.status)} ${hide(e.message).slice(0, 200)}`);
    process.exitCode = 1;
  }
}
console.log(changes ? `\n${changes} change${changes === 1 ? "" : "s"}${apply ? " made" : " to make"}.` : "\nEverything already matches.");
