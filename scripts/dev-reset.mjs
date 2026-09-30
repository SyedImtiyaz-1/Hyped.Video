// Local testing only: wipes all local data (users, videos, credits, saved tokens) and the local render state,
// so the next test starts clean. Your Clerk sign-in account is not touched; signing in again recreates the user.
//   npm run dev:reset
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

execSync(`docker compose exec -T postgres psql -U launchreel -d launchreel -c 'TRUNCATE "RepoToken", "CreditEntry", "Job", "User" CASCADE'`, { stdio: "inherit" });
rmSync(new URL("../render/.wrangler/state", import.meta.url), { recursive: true, force: true });
// Locally, each video's network proxy container outlives its render container; remove the leftovers.
const leftovers = execSync("docker ps -aq --filter name=workerd-hyped-render").toString().trim();
if (leftovers) execSync(`docker rm -f ${leftovers.split("\n").join(" ")}`, { stdio: "ignore" });
console.log("Local data wiped. Restart `npm run dev:all` if it's running, then sign in again (you get fresh test credits).");
