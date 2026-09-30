// Saves the live Clerk secret key for production, asked in a hidden macOS dialog so it's never typed into a terminal or
// pasted into a chat. It's checked with Clerk, then written to web/.env.production.local (git-ignored). Nothing goes
// live here: `npm run deploy:web` uploads it together with the live publishable key, so sign-in never breaks midway.
//
//   npm run clerk        (Clerk dashboard → your production instance → API keys → Secret key, sk_live_…)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../web/.env.production.local", import.meta.url);
if (!existsSync(FILE)) {
  console.log("No web/.env.production.local yet: it needs NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_… first.");
  process.exit(1);
}
let text = readFileSync(FILE, "utf8");

const ask = (prompt) => {
  try {
    return execFileSync("osascript", ["-e", `text returned of (display dialog ${JSON.stringify(prompt)} default answer "" with hidden answer with title "Hyped: Clerk production" buttons {"Cancel", "Save"} default button "Save")`], { encoding: "utf8" }).trim();
  } catch {
    console.log("Cancelled; nothing was changed.");
    process.exit(1);
  }
};

let key = ask("Clerk secret key for production (Clerk dashboard → production instance → API keys). It starts with sk_live_.");
for (let tries = 1; !/^sk_live_[A-Za-z0-9]{20,}$/.test(key); tries++) {
  if (tries >= 3) {
    console.log("That doesn't look like a live Clerk secret key (sk_live_…); nothing was changed.");
    process.exit(1);
  }
  key = ask(key.startsWith("sk_test_") ? "That's the development key (sk_test_). Paste the production one, starting with sk_live_." : "That doesn't look right. Paste the production secret key, starting with sk_live_.");
}

// Does Clerk accept it? A one-user list is the lightest read.
const res = await fetch("https://api.clerk.com/v1/users?limit=1", { headers: { authorization: `Bearer ${key}` } }).catch(() => null);
if (!res) console.log("Couldn't reach Clerk to check the key; saving it anyway.");
else if (res.status === 401 || res.status === 403) {
  console.log(`Clerk rejected that key (${res.status}). Copy it again from the production instance; nothing was changed.`);
  process.exit(1);
} else console.log(`✓ Clerk accepted the key (${res.status}).`);

const line = /^[ \t]*CLERK_SECRET_KEY[ \t]*=.*$/m;
text = line.test(text) ? text.replace(line, () => `CLERK_SECRET_KEY=${key}`) : `${text.replace(/\n?$/, "\n")}CLERK_SECRET_KEY=${key}\n`;
writeFileSync(FILE, text, { mode: 0o600 });
console.log("✓ Saved in web/.env.production.local. It goes live with the next `npm run deploy:web`, together with the live publishable key.");
