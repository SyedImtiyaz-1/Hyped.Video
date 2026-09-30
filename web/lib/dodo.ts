import DodoPayments from "dodopayments";
import type { PackKey } from "@launchreel/core";

let client: DodoPayments | undefined;

/** Lazy, so builds and pages that never touch billing don't need the API key. */
export function dodo() {
  return (client ??= new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  }));
}

// Our credit packs → Dodo product IDs (create one-time products in the Dodo dashboard, then paste the IDs).
// Read per call, not at module load: on Workers, env values are safest read inside a request.
const productIds = (): Record<PackKey, string | undefined> => ({
  STARTER: process.env.DODO_PRODUCT_STARTER,
  CREATOR: process.env.DODO_PRODUCT_CREATOR,
  PRO: process.env.DODO_PRODUCT_PRO,
});

export const productIdFor = (key: PackKey) => productIds()[key];

export function packFor(productId: string): PackKey | undefined {
  const ids = productIds();
  return (Object.keys(ids) as PackKey[]).find((k) => ids[k] === productId);
}
