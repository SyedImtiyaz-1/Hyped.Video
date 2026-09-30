// Claude engine: brag-slim through the Claude Agent SDK (the Claude Code harness).
import { query } from "@anthropic-ai/claude-agent-sdk";
import { llmCostUsd, type TokenUsage } from "@launchreel/core/pricing";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { baseAgentEnv, buildPrompt, type BragRequest, type BragResult, type RunOptions } from "./agent.ts";

export async function runClaude(workdir: string, req: BragRequest, opts: RunOptions): Promise<BragResult> {
  const { model } = opts;
  const abortController = new AbortController();
  opts.signal?.addEventListener("abort", () => abortController.abort());
  const started = Date.now();
  let result: any;

  try {
    for await (const msg of query({
      prompt: buildPrompt(req, "claude"),
      options: {
        cwd: workdir,
        model,
        effort: (process.env.CLAUDE_EFFORT as any) ?? "medium",
        maxBudgetUsd: Number(process.env.MAX_COST_PER_JOB_USD ?? 8),
        maxTurns: Number(process.env.MAX_TURNS ?? 150),
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true, // safe only because each job runs in a throwaway container
        settingSources: ["project"], // loads .claude/skills/brag-slim from the workspace
        // In the container, ANTHROPIC_BASE_URL points at the render Worker's virtual host, which adds the real key.
        // In the container the voice tool reaches speech through the Worker proxy (the key there is a placeholder).
        env: baseAgentEnv(["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "CLAUDE_CODE_MAX_RETRIES", "IS_SANDBOX", ...(process.env.OPENAI_BASE_URL ? ["OPENAI_BASE_URL", "OPENAI_API_KEY"] : [])]),
        persistSession: false,
        abortController,
      },
    })) {
      if (msg.type === "result") result = msg;
      else if (opts.onEvent && msg.type === "assistant") {
        for (const block of (msg as any).message?.content ?? []) {
          if (block.type === "tool_use") opts.onEvent(`${block.name} ${JSON.stringify(block.input).slice(0, 120)}`);
        }
      }
    }
  } catch (err) {
    result = { subtype: "error_during_execution", errors: [String(err)] };
  }

  const usage = extractUsage(result);
  const outputDir = join(workdir, "brag-output");
  const hasVideo = existsSync(join(outputDir, "brag.mp4"));
  const ok = result?.subtype === "success" && hasVideo;
  return {
    ok,
    error: ok ? undefined : describeFailure(result, hasVideo),
    outputDir: hasVideo ? outputDir : undefined,
    engine: "claude",
    model,
    numTurns: result?.num_turns ?? 0,
    usage,
    llmCostUsd: safeCost(model, usage),
    sdkReportedCostUsd: result?.total_cost_usd ?? 0,
    durationMs: Date.now() - started,
  };
}

// The result message carries aggregate usage; per-model usage (incl. cache) lives in modelUsage.
// Read both shapes defensively so SDK version bumps don't silently zero our cost accounting.
function extractUsage(result: any): TokenUsage {
  const u: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const mu = result?.modelUsage;
  const entries = Array.isArray(mu) ? mu : mu ? Object.values(mu) : [];
  if (entries.length) {
    for (const e of entries as any[]) {
      u.input += e.inputTokens ?? e.input_tokens ?? 0;
      u.output += e.outputTokens ?? e.output_tokens ?? 0;
      u.cacheRead += e.cacheReadInputTokens ?? e.cache_read_input_tokens ?? e.cache_read_tokens ?? 0;
      u.cacheWrite += e.cacheCreationInputTokens ?? e.cache_creation_input_tokens ?? e.cache_creation_tokens ?? 0;
    }
  } else if (result?.usage) {
    u.input = result.usage.input_tokens ?? 0;
    u.output = result.usage.output_tokens ?? 0;
    u.cacheRead = result.usage.cache_read_input_tokens ?? 0;
    u.cacheWrite = result.usage.cache_creation_input_tokens ?? 0;
  }
  return u;
}

export function safeCost(model: string, u: TokenUsage) {
  try {
    return llmCostUsd(model, u);
  } catch {
    return 0;
  }
}

function describeFailure(result: any, hasVideo: boolean): string {
  if (!result) return "Agent produced no result";
  if (result.subtype === "error_max_budget_usd") return "Hit per-video cost ceiling";
  if (result.subtype === "error_max_turns") return "Hit max turns";
  if (result.subtype === "success" && !hasVideo) return "Agent finished without brag-output/brag.mp4";
  return (result.errors ?? [result.subtype ?? "unknown error"]).join("; ").slice(0, 2000);
}
