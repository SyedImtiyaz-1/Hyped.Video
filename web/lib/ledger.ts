import { PACKS, type PackKey } from "@launchreel/core/pricing";

/**
 * The packs in a purchase reason: "CREATOR", "STARTER+CREATOR" for a cart with several packs, and "@INR" at the end
 * when it was paid in rupees.
 */
export function purchasedPacks(ref: string): { keys: PackKey[]; currency: string } {
  const [keys, currency = "USD"] = ref.split("@");
  return { keys: keys.split("+").filter((k): k is PackKey => k in PACKS), currency };
}

/** Turns a ledger reason ("job:<id>", "purchase:CREATOR", ...) into something a customer understands. */
export function describeEntry(reason: string): { label: string; href?: string } {
  const [kind, ref] = reason.split(":");
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
