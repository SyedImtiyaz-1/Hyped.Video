import { Check } from "lucide-react";
import { PACKS, QUALITY_CREDIT_MULTIPLIER, packPrice, perCredit, savingsPercent, type Currency, type PackKey } from "@launchreel/core";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { studioAvailable } from "@/lib/studio";

export const RECOMMENDED: PackKey = "CREATOR";
export const PACK_KEYS = Object.keys(PACKS) as PackKey[];
/** The pack with the lowest price per video: the "from" price. */
export const cheapestPack = (currency: Currency) => PACK_KEYS.reduce((best, k) => (perCredit(k, currency) < perCredit(best, currency) ? k : best));

/**
 * The credit packs, led by the price per video. On the site each links to billing; with `checkout` (the billing page)
 * each is a checkout button. Every number comes from PACKS, so the page never disagrees with what Dodo charges.
 */
export async function PackCards({ currency, checkout, highlight = RECOMMENDED }: { currency: Currency; checkout?: boolean; highlight?: PackKey }) {
  const cheapest = cheapestPack(currency);
  const studioOn = await studioAvailable();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {PACK_KEYS.map((key) => {
        const pack = PACKS[key];
        const featured = key === highlight;
        const save = savingsPercent(key, currency);
        const studio = Math.floor(pack.credits / QUALITY_CREDIT_MULTIPLIER.studio);
        const perks = [studioOn ? `Up to ${pack.credits} short videos, or ${studio} in Studio` : `Up to ${pack.credits} short videos`, "No watermark, commercial use", "Credits never expire"];
        const cta = `Get ${pack.name}`;
        return (
          <div key={key} className={cn("flex flex-col rounded-xl border bg-background-100 p-6 md:max-lg:flex-row md:max-lg:gap-10", featured ? "border-gray-1000 ring-1 ring-gray-1000" : "border-gray-alpha-400")}>
            <div className="md:max-lg:flex-1">
              <div className="flex min-h-5 items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{pack.name}</h3>
                {key === RECOMMENDED ? <Badge tone="inverted">Recommended</Badge> : key === cheapest ? <Badge>Lowest price per video</Badge> : null}
              </div>
              <p className="mt-4 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tabular-nums tracking-[-0.04em]">{money(perCredit(key, currency), currency)}</span>
                <span className="text-sm text-gray-900">per video</span>
              </p>
              <p className="mt-2 flex min-h-6 flex-wrap items-center gap-2 text-sm text-gray-900">
                <span>
                  <span className="font-medium tabular-nums text-gray-1000">{money(packPrice(key, currency), currency)}</span> one-time
                </span>
                {save > 0 && <Badge tone="green">Save {save}%</Badge>}
              </p>
              <p className="mt-5 rounded-lg border border-gray-alpha-400 bg-background-200 px-3 py-2.5 text-sm">
                <span className="font-semibold tabular-nums">{pack.credits} credits</span>
                {pack.bonus > 0 && (
                  <span className="text-gray-900">
                    {" "}
                    · {pack.credits - pack.bonus} + <span className="font-medium text-green-900">{pack.bonus} bonus</span>
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-1 flex-col">
              <ul className="mt-5 flex-1 space-y-2.5 text-sm md:max-lg:mt-0">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-green-900" />
                    {perk}
                  </li>
                ))}
              </ul>
              {checkout ? (
                <form action="/api/checkout" method="post" className="mt-6">
                  <input type="hidden" name="item" value={key} />
                  <Button variant={featured ? "primary" : "secondary"} className="w-full">
                    {cta}
                  </Button>
                </form>
              ) : (
                <ButtonLink href={`/dashboard/billing?pack=${key}`} variant={featured ? "primary" : "secondary"} className="mt-6 w-full">
                  {cta}
                </ButtonLink>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One line under the packs: which prices these are and how tax works, so the total is never a surprise. */
export function PriceNote({ currency, className }: { currency: Currency; className?: string }) {
  return (
    <p className={cn("text-[13px] text-gray-900", className)}>
      {currency === "inr"
        ? "Prices for India in rupees, GST included: what you see is what you pay. Pay by UPI or card. Your billing country sets the price at checkout."
        : "Prices in US dollars, taxes included: what you see is what you pay. In India? Prices are in rupees there."}
    </p>
  );
}
