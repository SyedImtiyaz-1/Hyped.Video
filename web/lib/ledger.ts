import { PACKS, REEL_PACKS, type PackKey, type ReelPackKey } from "@launchreel/core/pricing";

/**
 * The packs in a purchase reason: "CREATOR", "STARTER+CREATOR" for a cart with several packs, and "@INR" at the end
 * when it was paid in rupees.
 */
export function purchasedPacks(ref: string): { keys: PackKey[]; reelKeys: ReelPackKey[]; currency: string } {
  const [keys, currency = "USD"] = ref.split("@");
  const all = keys.split("+");
  return { keys: all.filter((k): k is PackKey => k in PACKS), reelKeys: all.filter((k): k is ReelPackKey => k in REEL_PACKS), currency };
}

/** Turns a ledger reason ("job:<id>", "purchase:CREATOR", ...) into something a customer understands. */
export function describeEntry(reason: string, balance: "credits" | "reels" = "credits"): { label: string; href?: string } {
  const [kind, ref] = reason.split(":");
  if (balance === "reels" && kind === "purchase") {
    const reels = purchasedPacks(ref ?? "").reelKeys.reduce((sum, key) => sum + REEL_PACKS[key].reels, 0);
    return { label: reels ? `${REEL_PACKS.REELS.name}: ${reels} reels` : "Reel purchase" };
  }
  if (balance === "reels" && kind === "job") return { label: "Reel", href: `/dashboard/videos/${ref}` };
  switch (kind) {
    case "signup_trial":
      return { label: "Free trial" };
    case "job":
      return { label: "Video render", href: `/dashboard/videos/${ref}` };
    case "refund":
      return { label: "Refund for a failed render", href: `/dashboard/videos/${ref}` };
    case "purchase": {
      const { keys } = purchasedPacks(ref ?? "");
      const credits = keys.reduce((sum, key) => sum + PACKS[key].credits, 0);
      if (!credits) return { label: "Credit purchase" };
      return { label: keys.length === 1 ? `${PACKS[keys[0]].name} pack: ${credits} credits` : `Bought ${credits} credits` };
    }
    case "revoke":
      return { label: "Credits removed after a refund or dispute" };
    case "dispute_won":
      return { label: "Dispute won, credits restored" };
    default:
      return { label: reason };
  }
}
