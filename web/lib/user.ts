import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { TRIAL_CREDITS } from "@launchreel/core";
import { getDb } from "./db";
import { demoUser, isDemo } from "./demo";

/** Returns the DB user for the signed-in Clerk user, creating it (with the free trial credits) on first visit. */
export const requireUser = cache(async () => {
  if (isDemo) return demoUser();
  const { userId } = await auth();
  if (!userId) throw new Error("UNAUTHENTICATED");
  const db = await getDb();
  const existing = await db.user.findUnique({ where: { id: userId } });
  if (existing) return existing;
  const cu = await currentUser();
  // Local testing only: extra credits on sign-up (DEV_SIGNUP_CREDITS in .env). Never applies outside `next dev`.
  const devCredits = process.env.NODE_ENV === "development" ? Math.max(0, Number(process.env.DEV_SIGNUP_CREDITS) || 0) : 0;
  return db.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      email: cu?.emailAddresses[0]?.emailAddress,
      credits: TRIAL_CREDITS + devCredits, // free trial credits, plus local test credits
      ledger: { create: [{ delta: TRIAL_CREDITS, reason: "signup_trial" }, ...(devCredits ? [{ delta: devCredits, reason: "dev_test_credits" }] : [])] },
    },
  });
});

/** The signed-in person's first name from Clerk, for greetings; null in demo mode or when they haven't given one. */
export const firstName = cache(async (): Promise<string | null> => {
  if (isDemo) return null;
  const cu = await currentUser().catch(() => null);
  return cu?.firstName?.trim() || null;
});

/** The admins' user ids (ADMIN_USER_IDS, comma-separated). */
export const adminIds = () =>
  (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function isAdmin(userId: string) {
  return adminIds().includes(userId);
}
