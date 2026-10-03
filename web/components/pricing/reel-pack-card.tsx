import { Captions, Check } from "lucide-react";
import { REEL_PACKS, reelPackPrice, type Currency, type ReelPackKey } from "@launchreel/core";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { money, plural } from "@/lib/format";

/**
 * The reel pack: reel credits for Reels only (one a reel up to 90 seconds), priced for creators. On the billing page
 * (`checkout`) it's a checkout button; elsewhere it links there. `owned` shows the reel credits left.
 */
export function ReelPackCard({ currency, checkout, owned, className }: { currency: Currency; checkout?: boolean; owned?: number; className?: string }) {
  const key: ReelPackKey = "REELS";
  const pack = REEL_PACKS[key];
  const price = reelPackPrice(key, currency);
  const perks = ["Captions, emojis, zooms, effects and sound", "Free edits for 7 days after each reel", currency === "inr" ? "Pay with UPI or card" : "Reel credits never expire"];
  return (
    <div className={cn("flex flex-col gap-6 rounded-xl border border-gray-alpha-400 bg-background-100 p-6 md:flex-row md:items-center", className)}>
      <div className="flex-1">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Captions className="size-4" />
          {pack.name}
        </h3>
        <p className="mt-3 flex items-baseline gap-1.5">
          <span className="text-4xl font-semibold tabular-nums tracking-[-0.04em]">{money(price / pack.reels, currency)}</span>
          <span className="text-sm text-gray-900">per reel</span>
        </p>
        <p className="mt-2 text-sm text-gray-900">
          <span className="font-medium tabular-nums text-gray-1000">{money(price, currency)}</span> one-time for {pack.reels} reels up to 90 seconds each
          {owned ? <span className="text-gray-1000"> · you have {plural(owned, "reel credit")}</span> : null}
        </p>
      </div>
      <ul className="flex-1 space-y-2 text-sm">
        {perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-green-900" />
            {perk}
          </li>
        ))}
      </ul>
      {checkout ? (
        <form action="/api/checkout" method="post" className="md:w-48">
          <input type="hidden" name="item" value={key} />
          <input type="hidden" name="currency" value={currency} />
          <Button variant="primary" className="w-full">
            Get {plural(pack.reels, "reel")}
          </Button>
        </form>
      ) : (
        <ButtonLink href="/dashboard/billing#reels" variant="primary" className="md:w-48">
          Get {plural(pack.reels, "reel")}
        </ButtonLink>
      )}
    </div>
  );
}
