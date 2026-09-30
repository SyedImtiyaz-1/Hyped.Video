// The contract between the render Worker (Cloudflare) and the runner (inside the Sandbox container).
// Types plus a few tiny value lists: both sides import this without pulling in each other's runtime code.
import type { TokenUsage } from "./pricing";
import type { VoiceId } from "./voices";

/** Which agent makes the video: Claude (Claude Agent SDK) or OpenAI (Codex CLI). */
export type Engine = "claude" | "openai";

/**
 * The quality tier a customer picks. Each tier always runs on one engine, set in the render Worker's config
 * (STANDARD_ENGINE, STUDIO_ENGINE). Customers only ever see the tier's name, never the engine behind it.
 */
export type Quality = "standard" | "studio";
export const QUALITIES: readonly Quality[] = ["standard", "studio"];

/** What kind of video: a launch announcement, a product demo walkthrough, or one feature in depth. */
export type VideoType = "launch" | "demo" | "feature";
export const VIDEO_TYPES: readonly VideoType[] = ["launch", "demo", "feature"];

/** Soundtrack: a real music track from the library, one the agent composes itself, or no music. */
export type MusicChoice = "upbeat" | "composed" | "none";
export const MUSIC_CHOICES: readonly MusicChoice[] = ["upbeat", "composed", "none"];

/** Optional guided brief from the customer. Every field is short free text. */
export type VideoBrief = {
  launching?: string; // what's new: "v2 with AI search"
  audience?: string; // who it's for
  highlights?: string[]; // up to 3 things to show
  cta?: string; // how the video should end: "Start free at acme.com"
};

export type BragRequest = {
  source: { type: "WEBSITE" | "GITHUB" | "LOCAL"; url: string };
  tone?: string | null;
  format?: string;
  durationSec?: number;
  notes?: string | null;
  revisionOf?: string | null; // free-text change request when revising an existing brag-output
  videoType?: VideoType;
  music?: MusicChoice;
  brief?: VideoBrief | null;
  /** Spoken voiceover by this voice; null or missing means no voiceover. */
  voice?: VoiceId | null;
  /** With a voiceover: burn the captions into the video (an SRT file is always delivered too). */
  captions?: boolean;
  /** The template this video started from (TEMPLATES in templates.ts): its beats shape the story. */
  template?: string | null;
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
  files: { video?: string; poster?: string; workspace?: string; captions?: string };
  shareCopy: string | null;
  plan: string | null;
};
