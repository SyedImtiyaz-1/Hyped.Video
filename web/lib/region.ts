import { headers } from "next/headers";
import { INR_COUNTRIES, type Currency } from "@launchreel/core";

/**
 * Which prices to show: rupees for visitors in India (Cloudflare's country header), dollars for everyone else. Dodo
 * charges by billing country, so this matches checkout for nearly everyone. `?currency=inr` or `?currency=usd`
 * overrides it, for travellers and for local testing (there's no country header in development).
 */
export async function visitorCurrency(override?: string): Promise<Currency> {
  if (override === "inr" || override === "usd") return override;
  const country = (await headers()).get("cf-ipcountry")?.toUpperCase();
  return country && INR_COUNTRIES.includes(country) ? "inr" : "usd";
}
