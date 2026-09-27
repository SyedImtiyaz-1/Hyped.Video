import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "./db";
import { demoUser, isDemo } from "./demo";

/** Returns the DB user for the signed-in Clerk user, creating it (with 1 free trial video) on first visit. */
export const requireUser = cache(async () => {
  if (isDemo) return demoUser();
  const { userId } = await auth();
  if (!userId) throw new Error("UNAUTHENTICATED");
  const db = await getDb();
  const existing = await db.user.findUnique({ where: { id: userId } });
  if (existing) return existing;
  const cu = await currentUser();
  return db.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: cu?.emailAddresses[0]?.emailAddress,
      credits: 2, // one free (watermarked) video
      ledger: { create: { delta: 2, reason: "signup_trial" } },
    },
  });
});

export function isAdmin(userId: string) {
  return (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).includes(userId);
}
