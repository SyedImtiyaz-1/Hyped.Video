// Measures real tokens and $ per video before you set prices.
// Runs brag-slim on the upstream example sites (and/or URLs you pass) with no database or storage.
//
//   npm run measure                                  # all 5 upstream examples, Claude engine
//   npm run measure -- https://linear.app https://github.com/owner/repo
//   npm run measure -- --duration 90 https://yourproduct.com     # a full 90s launch video (default 20s)
//   npm run measure -- --format vertical https://yourproduct.com  # landscape (default), vertical or square
//   CLAUDE_MODEL=claude-sonnet-5 npm run measure     # compare Claude models
//   ENGINE=openai OPENAI_MODEL=gpt-6-sol npm run measure   # the OpenAI (Codex) engine
import { COMPUTE_USD_PER_SECOND, STORAGE_USD_PER_VIDEO } from "@launchreel/core/pricing";
import { parseEngine } from "@launchreel/core/engines";
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { prepareWorkspace, runBrag, type BragRequest } from "./agent.ts";

const OUT = resolve(import.meta.dirname, "../../measurements");
const EXAMPLES = resolve(import.meta.dirname, "../../../brag-src/examples");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const csv = join(OUT, `run-${stamp}.csv`);

const args = process.argv.slice(2);
const option = (flag: string) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args.splice(i, 2)[1];
};
const durationSec = Number(option("--duration") ?? 20);
const format = option("--format") ?? "landscape";
const suffix = `-${format}-${durationSec}s`;
const cases: { name: string; req: BragRequest }[] = args.length
  ? args.map((url) => ({
      name: url.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-") + suffix,
      req: { source: { type: url.includes("github.com") ? "GITHUB" : "WEBSITE", url }, durationSec, format },
    }))
  : readdirSync(EXAMPLES).map((name) => ({ name: name + suffix, req: { source: { type: "LOCAL", url: join(EXAMPLES, name) }, durationSec, format } }));

mkdirSync(OUT, { recursive: true });
const engine = parseEngine(process.env.ENGINE);
const model = engine === "openai" ? (process.env.OPENAI_MODEL ?? "gpt-6-sol") : (process.env.CLAUDE_MODEL ?? "claude-opus-5-5");
console.log(`engine=${engine} model=${model} format=${format} duration=${durationSec}s`);
writeFileSync(csv, "case,engine,model,ok,turns,input,output,cache_read,cache_write,llm_usd,sdk_usd,minutes,compute_usd,total_cogs_usd,error\n");

const run = (cmd: string, a: string[], cwd: string) => execFileSync(cmd, a, { cwd, stdio: "pipe" });
for (const c of cases) {
  const workdir = join(OUT, stamp, c.name);
  console.log(`\n▶ ${c.name}`);
  prepareWorkspace(workdir, c.req, run);
  const r = await runBrag(workdir, c.req, { engine, model, onEvent: (m) => process.stdout.write(`  · ${m}\n`) });
  const compute = (r.durationMs / 1000) * COMPUTE_USD_PER_SECOND;
  const llm = r.sdkReportedCostUsd || r.llmCostUsd;
  const total = llm + compute + STORAGE_USD_PER_VIDEO;
  appendFileSync(csv, [c.name, r.engine, r.model, r.ok, r.numTurns, r.usage.input, r.usage.output, r.usage.cacheRead, r.usage.cacheWrite,
    r.llmCostUsd.toFixed(4), r.sdkReportedCostUsd.toFixed(4), (r.durationMs / 60000).toFixed(1), compute.toFixed(4), total.toFixed(4),
    JSON.stringify(r.error ?? "")].join(",") + "\n");
  console.log(`  ${r.ok ? "✅" : "❌"} turns=${r.numTurns} llm=$${llm.toFixed(2)} total=$${total.toFixed(2)} ${r.error ?? ""}`);
  if (r.outputDir && existsSync(join(r.outputDir, "brag.mp4"))) cpSync(join(r.outputDir, "brag.mp4"), join(OUT, stamp, `${c.name}.mp4`));
}
console.log(`\nResults: ${csv}\nPaste the mean total_cogs_usd into docs/UNIT_ECONOMICS.md and re-check plan margins.`);
