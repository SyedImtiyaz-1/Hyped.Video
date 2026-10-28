import type { Db } from "./db";

/** The two balances: credits (videos and reels) and reel credits (from reel packs, reels only). */
export type Balance = "credits" | "reels";

/** Atomically spend from a balance; throws if it's short. */
export async function spendCredits(db: Db, userId: string, amount: number, reason: string, balance: Balance = "credits") {
  return db.$transaction(async (tx) => {
    const res =
      balance === "reels"
        ? await tx.user.updateMany({ where: { id: userId, reelCredits: { gte: amount } }, data: { reelCredits: { decrement: amount } } })
        : await tx.user.updateMany({ where: { id: userId, credits: { gte: amount } }, data: { credits: { decrement: amount } } });
    if (res.count === 0) throw new Error("INSUFFICIENT_CREDITS");
    await tx.creditEntry.create({ data: { userId, delta: -amount, reason, balance } });
  });
}

/** Grant to a balance idempotently: paymentRef makes webhook retries and duplicate events safe. */
export async function grantCredits(db: Db, userId: string, amount: number, reason: string, paymentRef?: string, balance: Balance = "credits") {
  if (amount <= 0) return;
  if (paymentRef && (await db.creditEntry.findUnique({ where: { paymentRef } }))) return;
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: balance === "reels" ? { reelCredits: { increment: amount } } : { credits: { increment: amount } } }),
    db.creditEntry.create({ data: { userId, delta: amount, reason, paymentRef, balance } }),
  ]);
}

/**
 * Take back up to `amount` from a balance after a refund or dispute, never below zero
 * (credits already spent on videos are gone). Idempotent via paymentRef. Returns what was revoked.
 */
export async function revokeCredits(db: Db, userId: string, amount: number, reason: string, paymentRef: string, balance: Balance = "credits"): Promise<number> {
  return db.$transaction(async (tx) => {
    if (await tx.creditEntry.findUnique({ where: { paymentRef } })) return 0;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const take = Math.max(0, Math.min(balance === "reels" ? user.reelCredits : user.credits, amount));
    await tx.user.update({ where: { id: userId }, data: balance === "reels" ? { reelCredits: { decrement: take } } : { credits: { decrement: take } } });
    await tx.creditEntry.create({ data: { userId, delta: -take, reason, paymentRef, balance } });
    return take;
  });
}
