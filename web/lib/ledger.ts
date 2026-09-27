const cap = (s = "") => s.charAt(0) + s.slice(1).toLowerCase();

/** Turns a ledger reason ("job:<id>", "subscription:PRO", ...) into something a customer understands. */
export function describeEntry(reason: string): { label: string; href?: string } {
  const [kind, ref] = reason.split(":");
  switch (kind) {
    case "signup_trial":
      return { label: "Free trial credits" };
    case "job":
      return { label: "Video render", href: `/dashboard/videos/${ref}` };
    case "refund":
      return { label: "Refund for a failed render", href: `/dashboard/videos/${ref}` };
    case "subscription":
      return { label: `${cap(ref)} plan, monthly credits` };
    case "upgrade":
      return { label: `Upgrade to ${cap(ref)}` };
    case "purchase":
    case "pack_1":
      return { label: ref && ref !== "PACK_1" ? `Purchase (${ref})` : "Single video purchase" };
    case "revoke":
      return { label: "Credits removed after a refund or dispute" };
    case "dispute_won":
      return { label: "Dispute won, credits restored" };
    default:
      return { label: reason };
  }
}
