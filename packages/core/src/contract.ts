// The contract between the render Worker (Cloudflare) and the runner (inside the Sandbox container).
// Types only: both sides import this without pulling in each other's runtime code.
import type { TokenUsage } from "./pricing";

/** Which agent makes the video: Claude (Claude Agent SDK) or OpenAI (Codex CLI). */
export type Engine = "claude" | "openai";

export type BragRequest = {
  source: { type: "WEBSITE" | "GITHUB" | "LOCAL"; url: string };
  tone?: string | null;
  format?: string;
  durationSec?: number;
  notes?: string | null;
  revisionOf?: string | null; // free-text change request when revising an existing brag-output
};

/** Written by the render Worker to /workspace/job.json. */
export type JobSpec = {
  jobId: string;
  request: BragRequest;
  engine: Engine;
  model: string;
  watermark: boolean;
  watermarkText: string;
  hasParentWorkspace: boolean;
  /** Private repos: the render Worker downloaded the code to /workspace/source.tgz (the token never enters the container). */
  hasSourceArchive: boolean;
};

/** Written by the runner to /workspace/result.json. File paths are relative to /workspace. */
export type JobResult = {
  ok: boolean;
  error?: string;
  engine: Engine;
  model: string;
  numTurns: number;
  usage: TokenUsage;
  llmCostUsd: number;
  sdkReportedCostUsd: number;
  durationMs: number;
  files: { video?: string; poster?: string; workspace?: string };
  shareCopy: string | null;
  plan: string | null;
};
