// Creates the key pair that protects customers' private-repo tokens. Browsers encrypt tokens with the public
// key; only the render Worker, which holds the private key, can decrypt them.
//
//   npm run repo-keys -- --local        dev keys for testing: public key → .env, private key → render/.dev.vars
//   npm run repo-keys -- --production   the private key goes straight into the render Worker's secrets:
//                                       never printed, never written to disk, and Cloudflare secrets can't
//                                       be read back. The public key is written to web/wrangler.jsonc.
//
// Making a new key makes tokens saved with the old one unreadable; customers then add their token again.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const mode = process.argv.includes("--production") ? "production" : process.argv.includes("--local") ? "local" : null;
if (!mode) {
  console.log("Usage: npm run repo-keys -- --local   (or --production)");
  process.exit(1);
}

const kid = `${mode === "production" ? "p" : "d"}${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const publicKey = JSON.stringify({ ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid });
const privateKey = JSON.stringify({ ...(await crypto.subtle.exportKey("jwk", pair.privateKey)), kid });

/** Sets NAME='value' in a dotenv file, replacing an existing line or appending one. */
function setVar(file, name, value) {
  const url = new URL(`../${file}`, import.meta.url);
  const text = existsSync(url) ? readFileSync(url, "utf8") : "";
  const line = `${name}='${value}'`;
  const existing = new RegExp(`^${name}=.*$`, "m");
  writeFileSync(url, existing.test(text) ? text.replace(existing, line) : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`);
}

if (mode === "local") {
  setVar(".env", "REPO_TOKEN_PUBLIC_KEY", publicKey);
  setVar("render/.dev.vars", "REPO_TOKEN_PRIVATE_KEY", privateKey);
  console.log(`Dev key ${kid} created: public key in .env, private key in render/.dev.vars.`);
  console.log("For local testing only. Production gets its own key: npm run repo-keys -- --production");
} else {
  const put = spawnSync("npx", ["wrangler", "secret", "put", "REPO_TOKEN_PRIVATE_KEY"], {
    cwd: new URL("../render", import.meta.url),
    input: privateKey,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (put.status !== 0) {
    console.log("\nCouldn't store the private key (is `npx wrangler login` done?). Nothing was changed.");
    process.exit(1);
  }
  const config = new URL("../web/wrangler.jsonc", import.meta.url);
  const text = readFileSync(config, "utf8");
  const slot = /("REPO_TOKEN_PUBLIC_KEY":\s*)"(?:[^"\\]|\\.)*"/;
  if (!slot.test(text)) {
    console.log(`\nPrivate key stored, but web/wrangler.jsonc has no "REPO_TOKEN_PUBLIC_KEY" var. Add it with this value:\n${publicKey}`);
    process.exit(1);
  }
  writeFileSync(config, text.replace(slot, `$1${JSON.stringify(publicKey)}`));
  console.log(`\nProduction key ${kid}: private key stored as a render Worker secret (not shown, not saved).`);
  console.log("Public key written to web/wrangler.jsonc. Deploy the render Worker, then the web Worker.");
}
