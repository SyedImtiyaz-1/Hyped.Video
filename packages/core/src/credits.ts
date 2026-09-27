import type { Db } from "./db";

/** Atomically spend credits; throws if balance is insufficient. */
export async function spendCredits(db: Db, userId: string, amount: number, reason: string) {
  return db.$transaction(async (tx) => {
    const res = await tx.user.updateMany({ where: { id: userId, credits: { gte: amount } }, data: { credits: { decrement: amount } } });
    if (res.count === 0) throw new Error("INSUFFICIENT_CREDITS");
    await tx.creditEntry.create({ data: { userId, delta: -amount, reason } });
  });
}

/** Grant credits idempotently: paymentRef makes webhook retries and duplicate events safe. */
export async function grantCredits(db: Db, userId: string, amount: number, reason: string, paymentRef?: string) {
  if (amount <= 0) return;
  if (paymentRef && (await db.creditEntry.findUnique({ where: { paymentRef } }))) return;
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { credits: { increment: amount } } }),
    db.creditEntry.create({ data: { userId, delta: amount, reason, paymentRef } }),
  ]);
}

/**
 * Take back up to `amount` credits after a refund or dispute, never below zero
 * (credits already spent on videos are gone). Idempotent via paymentRef. Returns what was revoked.
 */
export async function revokeCredits(db: Db, userId: string, amount: number, reason: string, paymentRef: string): Promise<number> {
  return db.$transaction(async (tx) => {
    if (await tx.creditEntry.findUnique({ where: { paymentRef } })) return 0;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const take = Math.max(0, Math.min(user.credits, amount));
    await tx.user.update({ where: { id: userId }, data: { credits: { decrement: take } } });
    await tx.creditEntry.create({ data: { userId, delta: -take, reason, paymentRef } });
    return take;
  });
}
