// OpenAI engine: brag-slim through the Codex CLI (`codex exec --json`), which reads the same skill
// from .agents/skills. In the container, Codex talks to http://openai.internal/v1, a virtual host the
// render Worker answers, adding the real OpenAI key outside the container.
import type { TokenUsage } from "@launchreel/core/pricing";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { baseAgentEnv, buildPrompt, type BragRequest, type BragResult, type RunOptions } from "./agent.ts";
import { safeCost } from "./claude.ts";

const TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS ?? 40 * 60_000);

// Codex has no dollar cap like the Agent SDK's maxBudgetUsd, so the guard is a step limit plus a wall-clock
// limit (and the render Workflow's own time limit). Also set a monthly budget on the OpenAI project.
const MAX_STEPS = Number(process.env.MAX_TURNS ?? 150) * 2;

export async function runCodex(workdir: string, req: BragRequest, opts: RunOptions): Promise<BragResult> {
  const { model } = opts;
  const started = Date.now();
  const baseUrl = process.env.OPENAI_BASE_URL; // set in the container; unset locally (direct to OpenAI)
  const effort = process.env.OPENAI_EFFORT ?? process.env.CLAUDE_EFFORT ?? "medium";

  const args = [
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--dangerously-bypass-approvals-and-sandbox", // the throwaway container is the sandbox
    "-C", workdir,
    "-m", model,
    "-c", `model_reasoning_effort="${effort}"`,
  ];
  if (baseUrl) {
    args.push(
      "-c", `model_providers.render={ name = "render-proxy", base_url = "${baseUrl}", env_key = "OPENAI_API_KEY", wire_api = "responses" }`,
      "-c", 'model_provider="render"',
    );
  }
  args.push(buildPrompt(req, "openai"));

  // Codex also loads skills and settings from the home folder (~/.agents/skills, ~/.codex). On a laptop that
  // pulls in whatever skills you have installed, so give it a fresh, empty home: it sees only brag-slim,
  // exactly as in the container. The real Playwright browsers and npm cache stay in use, so nothing re-downloads.
  const realHome = homedir();
  const home = mkdtempSync(join(tmpdir(), "codex-home-"));
  mkdirSync(join(home, ".codex"));
  const env = baseAgentEnv([]);
  env.HOME = home;
  env.CODEX_HOME = join(home, ".codex");
  env.PLAYWRIGHT_BROWSERS_PATH ??= join(realHome, process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright");
  env.npm_config_cache = process.env.npm_config_cache ?? join(realHome, ".npm");
  if (baseUrl) {
    env.OPENAI_API_KEY = process.env.OPENAI_API_KEY; // placeholder; the Worker adds the real key
    env.OPENAI_BASE_URL = baseUrl; // for the voice tool, which the agent runs from its shell
  }
  else env.CODEX_API_KEY = process.env.CODEX_API_KEY ?? process.env.OPENAI_API_KEY; // local benchmark: real key

  const usage: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let steps = 0;
  let turnFailed: string | undefined;
  let lastError: string | undefined;
  let stopReason: string | undefined;

  const child = spawn(process.env.CODEX_BIN ?? "codex", args, { cwd: workdir, env, stdio: ["ignore", "pipe", "pipe"] });
  const stop = (reason: string) => {
    if (!stopReason) stopReason = reason;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 10_000).unref();
  };
  const timer = setTimeout(() => stop("Render took too long"), TIMEOUT_MS);
  opts.signal?.addEventListener("abort", () => stop("Aborted"));

  let stderrTail = "";
  child.stderr.on("data", (d: Buffer) => (stderrTail = (stderrTail + d.toString()).slice(-2000)));

  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      return; // not an event line
    }
    switch (ev.type) {
      case "turn.completed": {
        // OpenAI semantics: cached_input_tokens is a subset of input_tokens, and output_tokens already
        // includes reasoning tokens (reasoning_output_tokens is a breakdown, not an extra).
        const u = ev.usage ?? {};
        const cached = u.cached_input_tokens ?? 0;
        usage.input += Math.max(0, (u.input_tokens ?? 0) - cached);
        usage.cacheRead += cached;
        usage.output += u.output_tokens ?? 0;
        break;
      }
      case "turn.failed":
        turnFailed = ev.error?.message ?? JSON.stringify(ev.error ?? ev).slice(0, 500);
        break;
      case "error":
        lastError = ev.message ?? ev.error?.message ?? JSON.stringify(ev).slice(0, 500);
        break;
      case "item.started": {
        // Logged at the start too, so a command that never returns shows up in the job log.
        const item = ev.item ?? {};
        if (item.type === "command_execution") opts.onEvent?.(`started ${String(item.command ?? "").slice(0, 120)}`);
        break;
      }
      case "item.completed": {
        const item = ev.item ?? {};
        if (item.type && item.type !== "agent_message" && item.type !== "reasoning") {
          steps++;
          opts.onEvent?.(`${item.type} ${String(item.command ?? item.path ?? item.query ?? "").slice(0, 120)}`);
          if (steps > MAX_STEPS) stop("Hit max steps");
        }
        break;
      }
    }
  });

  const exitCode: number | null = await new Promise((resolveExit) => {
    child.on("close", (code) => resolveExit(code));
    child.on("error", (err) => {
      lastError = `Could not start Codex: ${err.message}`;
      resolveExit(null);
    });
  });
  clearTimeout(timer);
  rmSync(home, { recursive: true, force: true });

  const outputDir = join(workdir, "brag-output");
  const hasVideo = existsSync(join(outputDir, "brag.mp4"));
  const ok = exitCode === 0 && !stopReason && !turnFailed && hasVideo;
  const error = ok
    ? undefined
    : (stopReason ??
      turnFailed ??
      lastError ??
      (exitCode === 0 ? "Agent finished without brag-output/brag.mp4" : `Codex exited with code ${exitCode}: ${stderrTail.trim().slice(-500)}`)
    ).slice(0, 2000);

  const cost = safeCost(model, usage);
  return {
    ok,
    error,
    outputDir: hasVideo ? outputDir : undefined,
    engine: "openai",
    model,
    numTurns: steps,
    usage,
    llmCostUsd: cost,
    sdkReportedCostUsd: 0, // Codex doesn't report dollars; llmCostUsd is computed from its token counts
    durationMs: Date.now() - started,
  };
}
