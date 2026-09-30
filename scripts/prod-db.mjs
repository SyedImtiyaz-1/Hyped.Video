// Updates production after a database schema change: pushes the Prisma schema to the production Postgres (Neon)
// and gives the Hyperdrive link the current password. The password is asked in a hidden macOS dialog: it's never
// printed, never saved, and scrubbed from any error output.
//
//   npm run prod:db        (run it after changing packages/core/prisma/schema.prisma, and after resetting the password)
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const RENDER = new URL("../render/", import.meta.url);
const id = readFileSync(new URL("wrangler.jsonc", RENDER), "utf8").match(/"HYPERDRIVE"[\s\S]*?"id":\s*"([0-9a-f]{32})"/)?.[1];
if (!id) throw new Error("No Hyperdrive id in render/wrangler.jsonc");

// Where production connects (host, user, database), read from the Hyperdrive config itself.
const info = spawnSync("npx", ["wrangler", "hyperdrive", "get", id], { cwd: RENDER, encoding: "utf8" });
const json = info.stdout.slice(info.stdout.indexOf("{"));
const { origin } = JSON.parse(json.slice(0, json.lastIndexOf("}") + 1));
console.log(`Production database: ${origin.database} on ${origin.host} (user ${origin.user})`);

// Paste either the password or Neon's whole connection string (Connect → neondb_owner): the string always carries
// the right password for its branch, and we check it points at the same database as Hyperdrive.
let input;
try {
  const prompt = `Paste the Neon password for ${origin.user}, or the whole connection string from Neon → Connect. It stays on this Mac.`;
  input = execFileSync("osascript", ["-e", `text returned of (display dialog ${JSON.stringify(prompt)} default answer "" with hidden answer with title "Hyped: update production database" buttons {"Cancel", "Update"} default button "Update")`], { encoding: "utf8" }).trim();
} catch {
  console.log("Cancelled; nothing was changed.");
  process.exit(1);
}
// Accept any of Neon's snippets (a bare connection string, psql '...', DATABASE_URL=...), or just the password.
let password = input;
const found = input.match(/postgres(?:ql)?:\/\/[^\s'"]+/i)?.[0];
if (found) {
  const pasted = new URL(found);
  // Neon's pooled address ("...-pooler...") is the same database.
  const host = pasted.hostname.replace("-pooler.", ".");
  if (host !== origin.host) {
    // A different database: move production to it, but only after an explicit yes.
    const question = `This is a different database (${host}) from the one the live site uses (${origin.host}). Move the live site to it? Hyped's tables are created there; the old database is left as it is.`;
    const answer = spawnSync("osascript", ["-e", `button returned of (display dialog ${JSON.stringify(question)} with title "Hyped: move production database" buttons {"Cancel", "Move"} default button "Cancel")`], { encoding: "utf8" });
    if (answer.status !== 0 || answer.stdout.trim() !== "Move") {
      console.log("Not moved; nothing was changed.");
      process.exit(1);
    }
    Object.assign(origin, { host, port: Number(pasted.port) || 5432, user: decodeURIComponent(pasted.username), database: pasted.pathname.replace(/^\//, "") || "neondb" });
    console.log(`Moving production to ${origin.database} on ${origin.host} (user ${origin.user}).`);
  }
  password = decodeURIComponent(pasted.password);
  console.log(`Using the password inside the pasted connection string (${password.length} characters).`);
} else {
  console.log(`Using the pasted password (${password.length} characters).`);
  // A Neon password is short (npg_ plus 12 characters); spaces, @ or : mean something else was pasted.
  if (password.length > 40 || /[\s@:/]/.test(password)) {
    console.log("That doesn't look like a Neon password (they're about 16 characters, like npg_…). Copy the password or the whole connection string of the database above. Nothing was changed.");
    process.exit(1);
  }
}
if (!password) {
  console.log("No password entered; nothing was changed.");
  process.exit(1);
}
if (/^\*+$|\*{4,}/.test(password)) {
  console.log("That password is hidden with asterisks. In Neon → Connect, click “Show password” before copying. Nothing was changed.");
  process.exit(1);
}

const scrub = (text) => String(text ?? "").split(password).join("[password]").split(encodeURIComponent(password)).join("[password]");
function run(label, cmd, args, opts) {
  console.log(`\n${label}…`);
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  process.stdout.write(scrub(r.stdout));
  process.stderr.write(scrub(r.stderr));
  if (r.status !== 0) {
    console.log(`\n✗ ${label} failed; stopping here.`);
    process.exit(1);
  }
}

const url = `postgresql://${encodeURIComponent(origin.user)}:${encodeURIComponent(password)}@${origin.host}:${origin.port ?? 5432}/${origin.database}`;
run("Updating the database schema", "node", ["node_modules/prisma/build/index.js", "db", "push", "--schema", "packages/core/prisma/schema.prisma"], {
  cwd: new URL("../", import.meta.url),
  env: { ...process.env, DATABASE_URL: `${url}?sslmode=require&connect_timeout=30` },
});
run("Updating the Hyperdrive link", "npx", ["wrangler", "hyperdrive", "update", id, "--connection-string", url], { cwd: RENDER });
console.log("\n✓ Production database is up to date.");
