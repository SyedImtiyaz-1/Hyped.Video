// Local testing only: give a user more credits.  npm run dev:credits -- you@example.com 20
import { createDb, grantCredits } from "@launchreel/core";

const [email, amount = "20"] = process.argv.slice(2);
if (!email) {
  console.log("Usage: npm run dev:credits -- <email> [amount]   (the user must have signed in once)");
  process.exit(1);
}
const db = createDb(process.env.DATABASE_URL!);
const user = await db.user.findFirst({ where: { email } });
if (!user) {
  console.log(`No user with email ${email}. Sign in to the local app once first.`);
  process.exit(1);
}
await grantCredits(db, user.id, Number(amount), "dev_test_credits");
const after = await db.user.findUnique({ where: { id: user.id } });
console.log(`${email} now has ${after?.credits} credits.`);
await db.$disconnect();
