import DodoPayments from "dodopayments";
import { PRODUCTS, type PaidPlan, type ProductKey } from "@launchreel/core";

let client: DodoPayments | undefined;

/** Lazy, so builds and pages that never touch billing don't need the API key. */
export function dodo() {
  return (client ??= new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  }));
}

// Our product keys → Dodo product IDs (create the products in the Dodo dashboard, then paste the IDs).
// Read per call, not at module load: on Workers, env values are safest read inside a request.
const productIds = (): Record<ProductKey, string | undefined> => ({
  STARTER: process.env.DODO_PRODUCT_STARTER,
  PRO: process.env.DODO_PRODUCT_PRO,
  AGENCY: process.env.DODO_PRODUCT_AGENCY,
  PACK_1: process.env.DODO_PRODUCT_PACK_1,
});

export const productIdFor = (key: ProductKey) => productIds()[key];

export function productKeyFor(productId: string): ProductKey | undefined {
  const ids = productIds();
  return (Object.keys(ids) as ProductKey[]).find((k) => ids[k] === productId);
}

export function planFor(productId: string): PaidPlan | undefined {
  const key = productKeyFor(productId);
  const product = key ? PRODUCTS[key] : undefined;
  return product?.kind === "subscription" ? product.plan : undefined;
}
