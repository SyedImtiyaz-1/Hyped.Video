import DodoPayments from "dodopayments";
import type { PackKey, ReelPackKey } from "@launchreel/core";

let client: DodoPayments | undefined;

/** Lazy, so builds and pages that never touch billing don't need the API key. */
export function dodo() {
  return (client ??= new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  }));
}

// Our packs → Dodo product IDs (scripts/dodo-sync-packs.mjs keeps the products in step, `npm run secrets` the IDs).
// Read per call, not at module load: on Workers, env values are safest read inside a request.
const productIds = (): Record<PackKey | ReelPackKey, string | undefined> => ({
  STARTER: process.env.DODO_PRODUCT_STARTER,
  CREATOR: process.env.DODO_PRODUCT_CREATOR,
  PRO: process.env.DODO_PRODUCT_PRO,
  REELS: process.env.DODO_PRODUCT_REELS,
});

export const productIdFor = (key: PackKey | ReelPackKey) => productIds()[key];

/** Whether the reel pack can be bought yet: its Dodo product is set (`npm run dodo:sync -- --apply`, then `npm run secrets`). */
export const reelPackOn = () => Boolean(productIdFor("REELS")) || process.env.DEMO_MODE === "true";

/** The pack a Dodo product sells: a credit pack or a reel pack. */
export function packFor(productId: string): PackKey | ReelPackKey | undefined {
  const ids = productIds();
  return (Object.keys(ids) as (PackKey | ReelPackKey)[]).find((k) => ids[k] === productId);
}
