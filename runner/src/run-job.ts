// Entry point inside the Cloudflare Sandbox container: runs exactly one video job, then exits.
//
// Input:  /workspace/job.json            (written by the render Worker)
//         /workspace/parent.tgz          (optional: the parent video's workspace, for revisions)
//         /workspace/source.tgz          (optional: a private repo, downloaded by the render Worker)
// Output: /workspace/result.json         (usage, cost, outcome, share copy, plan)
//         /workspace/out/brag.mp4, brag.jpg, workspace.tgz
//
// No secrets live in this container. Claude Code calls http://anthropic.internal with a placeholder
// key; the render Worker answers that virtual host and adds the real key on the way to Anthropic.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { JobResult, JobSpec } from "@launchreel/core/contract";
import { VOICE_TIMINGS_USD_PER_MINUTE, VOICE_TTS_USD_PER_MINUTE } from "@launchreel/core/pricing";
import { prepareWorkspace, runBrag } from "./agent.ts";

const ROOT = process.env.JOB_ROOT ?? "/workspace";
const workdir = join(ROOT, "project");
const outDir = join(ROOT, "out");
const run = (cmd: string, args: string[], cwd: string) => execFileSync(cmd, args, { cwd, stdio: "pipe", timeout: 5 * 60_000 });
const readIfExists = (p: string) => (existsSync(p) ? readFileSync(p, "utf8").slice(0, 50_000) : null);
// The voice tool logs what it recorded here, one JSON line per recording, so the job's cost includes speech.
const VOICE_USAGE = join(ROOT, "voice-usage.jsonl");

function voiceCostUsd() {
  const lines = (readIfExists(VOICE_USAGE) ?? "").split("\n").filter(Boolean);
  return lines.reduce((sum, line) => {
    try {
      const u = JSON.parse(line) as { ttsSeconds?: number; timingSeconds?: number };
      return sum + ((u.ttsSeconds ?? 0) / 60) * VOICE_TTS_USD_PER_MINUTE + ((u.timingSeconds ?? 0) / 60) * VOICE_TIMINGS_USD_PER_MINUTE;
    } catch {
      return sum;
    }
  }, 0);
}

/** The library's music is CC BY 4.0; the composer waives the credit, but a line in the share copy is appreciated. */
function withMusicCredit(shareCopy: string | null, outputDir: string) {
  const track = readIfExists(join(outputDir, "music.txt"));
  if (!shareCopy || !track || !/ende-dot-app/.test(track) || shareCopy.includes("ende.app")) return shareCopy;
  return `${shareCopy.trim()}\n\nMusic by Sascha Ende (ende.app)`;
}

function finish(result: JobResult) {
  writeFileSync(join(ROOT, "result.json"), JSON.stringify(result));
  console.log(`done engine=${result.engine} ok=${result.ok} turns=${result.numTurns} cost=$${(result.sdkReportedCostUsd || result.llmCostUsd).toFixed(3)} ${result.error ?? ""}`);
}

function watermark(file: string, text: string) {
  const tmp = file.replace(/\.mp4$/, ".wm.mp4");
  const safe = text.replace(/['\\:%]/g, ""); // characters drawtext treats specially
  execFileSync("ffmpeg", [
    "-y", "-i", file,
    "-vf", `drawtext=text='${safe}':fontcolor=white@0.85:fontsize=h/28:x=w-tw-h/30:y=h-th-h/30:box=1:boxcolor=black@0.35:boxborderw=12`,
    "-c:a", "copy", tmp,
  ]);
  renameSync(tmp, file);
}

const spec: JobSpec = JSON.parse(readFileSync(join(ROOT, "job.json"), "utf8"));
mkdirSync(outDir, { recursive: true });

try {
  const sourceArchive = spec.hasSourceArchive ? join(ROOT, "source.tgz") : undefined;
  prepareWorkspace(workdir, spec.request, run, sourceArchive);
  if (sourceArchive) rmSync(sourceArchive, { force: true });
  if (spec.hasParentWorkspace) run("tar", ["-xzf", join(ROOT, "parent.tgz")], workdir);

  process.env.HYPED_USAGE_FILE = VOICE_USAGE;
  const { outputDir, ...res } = await runBrag(workdir, spec.request, { engine: spec.engine, model: spec.model, onEvent: (m) => console.log(m) });
  const voiceCost = voiceCostUsd();
  res.llmCostUsd += voiceCost;
  if (res.sdkReportedCostUsd) res.sdkReportedCostUsd += voiceCost;
  const files: JobResult["files"] = {};
  if (res.ok && outputDir) {
    const video = join(outputDir, "brag.mp4");
    if (spec.watermark) watermark(video, spec.watermarkText);
    copyFileSync(video, join(outDir, "brag.mp4"));
    files.video = "out/brag.mp4";
    if (existsSync(join(outputDir, "brag.jpg"))) {
      copyFileSync(join(outputDir, "brag.jpg"), join(outDir, "brag.jpg"));
      files.poster = "out/brag.jpg";
    }
    // Voiceover videos deliver their captions as SRT too (the agent copies them out; fall back to the tool's copy).
    const srt = [join(outputDir, "captions.srt"), join(outputDir, "work/voice/captions.srt")].find((p) => existsSync(p));
    if (spec.request.voice && srt) {
      copyFileSync(srt, join(outDir, "captions.srt"));
      files.captions = "out/captions.srt";
    }
    // Keep the plan and composition so a revision edits this video instead of starting over.
    run("tar", ["--exclude=node_modules", "--exclude=brag-output/work/frames", "-czf", join(outDir, "workspace.tgz"), "brag-output"], workdir);
    files.workspace = "out/workspace.tgz";
  }
  finish({
    ...res,
    files,
    shareCopy: outputDir ? withMusicCredit(readIfExists(join(outputDir, "share-copy.txt")), outputDir) : null,
    plan: outputDir ? readIfExists(join(outputDir, "brag-plan.md")) : null,
  });
} catch (err) {
  finish({
    ok: false,
    error: String(err instanceof Error ? err.message : err).slice(0, 2000),
    engine: spec.engine,
    model: spec.model,
    numTurns: 0,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    llmCostUsd: 0,
    sdkReportedCostUsd: 0,
    durationMs: 0,
    files: {},
    shareCopy: null,
    plan: null,
  });
}
