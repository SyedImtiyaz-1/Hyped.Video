// Copies the upstream brag skills (MIT) into runner/skills so the Docker image and local
// worker can load them. Usage: node scripts/sync-skill.mjs [path-to-brag-checkout]
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const src = resolve(process.argv[2] ?? "../brag-src");
const dest = resolve("runner/skills");
if (!existsSync(`${src}/skills/brag-slim/SKILL.md`)) {
  console.error(`No brag checkout at ${src}. git clone https://github.com/latent-spaces/brag first.`);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
for (const name of ["brag-slim", "brag"]) {
  cpSync(`${src}/skills/${name}`, `${dest}/${name}`, { recursive: true });
}
cpSync(`${src}/LICENSE`, `${dest}/LICENSE.brag`);
console.log(`Synced brag skills -> ${dest}`);
