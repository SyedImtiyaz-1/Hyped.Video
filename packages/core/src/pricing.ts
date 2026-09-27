// Single source of truth for what we charge and what it costs us.
// Prices are $/1M tokens (first-party APIs, Sept 2026). Re-check both providers before changing plans.
export const MODEL_PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite5m: number }> = {
  // Anthropic (Claude engine)
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite5m: 1.25 },
  // OpenAI (Codex engine). Codex reports uncached input, cached input and output; it doesn't report
  // cache writes, so those are billed as ordinary input. Verify at openai.com/api/pricing.
  "gpt-6-astra": { input: 10, output: 50, cacheRead: 1, cacheWrite5m: 10 },
  "gpt-6-sol": { input: 2, output: 10, cacheRead: 0.2, cacheWrite5m: 2 },
  "gpt-6-luna": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite5m: 0.1 },
};

export type TokenUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };

export function llmCostUsd(model: string, u: TokenUsage): number {
  const p = MODEL_PRICES[model];
  if (!p) throw new Error(`No price for model ${model}`);
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.cacheRead + u.cacheWrite * p.cacheWrite5m) / 1e6;
}

// Render compute: a Cloudflare Containers standard-4 instance (4 vCPU, 12 GiB, 20 GB disk).
// 4 × $0.000020 vCPU-s + 12 × $0.0000025 GiB-s + 20 × $0.00000007 GB-s ≈ $0.00011/s, about $0.10 per 15-minute render.
export const COMPUTE_USD_PER_SECOND = 0.00011;
// Storage + egress per video on R2 (~15 MB mp4, zero egress) — effectively rounding error.
export const STORAGE_USD_PER_VIDEO = 0.002;

// Credits: 1 credit = one ~20s video in one format. Revisions are cheaper because the plan is reused.
export const CREDIT_COST = { newVideo: 2, revision: 1 } as const;

/** Videos longer than this are full launch videos: a longer structure, higher limits and more credits. */
export const LONG_VIDEO_SECONDS = 45;

/** Credits for a video of this length: short teasers (up to 30s) x1, up to 60s x2, up to 90s x3. */
export function creditsFor(kind: keyof typeof CREDIT_COST, durationSec: number): number {
  return CREDIT_COST[kind] * (durationSec > 60 ? 3 : durationSec > 30 ? 2 : 1);
}

export type PlanId = "FREE" | "STARTER" | "PRO" | "AGENCY";
export const PLANS: Record<PlanId, { name: string; priceUsd: number; creditsPerMonth: number; watermark: boolean; blurb: string }> = {
  FREE: { name: "Free", priceUsd: 0, creditsPerMonth: 0, watermark: true, blurb: "1 watermarked video to try it" },
  STARTER: { name: "Starter", priceUsd: 39, creditsPerMonth: 8, watermark: false, blurb: "4 videos/mo, all tones and formats" },
  PRO: { name: "Pro", priceUsd: 99, creditsPerMonth: 24, watermark: false, blurb: "12 videos/mo, revisions, vertical + square" },
  AGENCY: { name: "Agency", priceUsd: 299, creditsPerMonth: 60, watermark: false, blurb: "30 videos/mo, white-label, priority queue" },
};
export const PACK_1 = { priceUsd: 19, credits: 2 }; // pay-as-you-go single video

export type PaidPlan = Exclude<PlanId, "FREE">;

// What each purchasable item grants. Provider-agnostic: the web app maps these keys to payment-provider
// product IDs. To add the Launch Kit or an extra-video pack, add a line here and a product in Dodo.
export const PRODUCTS = {
  STARTER: { kind: "subscription", plan: "STARTER" },
  PRO: { kind: "subscription", plan: "PRO" },
  AGENCY: { kind: "subscription", plan: "AGENCY" },
  PACK_1: { kind: "one_time", credits: PACK_1.credits },
} as const satisfies Record<string, { kind: "subscription"; plan: PaidPlan } | { kind: "one_time"; credits: number }>;
export type ProductKey = keyof typeof PRODUCTS;

export function unitEconomics(job: { llmCostUsd: number | null; computeSeconds: number | null }) {
  const llm = job.llmCostUsd ?? 0;
  const compute = (job.computeSeconds ?? 0) * COMPUTE_USD_PER_SECOND;
  return { llm, compute, storage: STORAGE_USD_PER_VIDEO, total: llm + compute + STORAGE_USD_PER_VIDEO };
}
