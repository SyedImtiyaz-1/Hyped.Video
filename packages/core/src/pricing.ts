// Single source of truth for what we charge and what it costs us.
// Prices are $/1M tokens (first-party APIs, Sept 2026). Re-check both providers before changing plans.
import type { Quality } from "./contract";

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
// Voiceover: speech from gpt-4o-mini-tts (about $0.015 per minute of audio) and word timings from Workers AI
// Whisper (about $0.0005 per minute). Added to a job's AI cost from the voice tool's usage log.
export const VOICE_TTS_USD_PER_MINUTE = 0.015;
export const VOICE_TIMINGS_USD_PER_MINUTE = 0.0005;
// Storage + egress per video on R2 (~15 MB mp4, zero egress) — effectively rounding error.
export const STORAGE_USD_PER_VIDEO = 0.002;

// Credits: 1 credit = one Standard video up to 30 seconds; longer videos and Studio use more (creditsFor).
// Customers buy credits in one-time packs that never expire. There are no subscriptions.

/** Videos longer than this are full launch videos: a longer structure, higher limits and more credits. */
export const LONG_VIDEO_SECONDS = 45;

/** Studio videos run on the more capable (and more expensive) engine. Re-check once Studio costs are measured. */
export const QUALITY_CREDIT_MULTIPLIER: Record<Quality, number> = { standard: 1, studio: 3 };

/**
 * Credits for a video: 1 up to 30s, 2 up to 60s, 3 up to 90s, times the quality tier.
 * A revision reuses the plan and composition, so it costs half, rounded up.
 */
export function creditsFor(kind: "newVideo" | "revision", durationSec: number, quality: Quality = "standard"): number {
  const full = (durationSec > 60 ? 3 : durationSec > 30 ? 2 : 1) * QUALITY_CREDIT_MULTIPLIER[quality];
  return kind === "revision" ? Math.ceil(full / 2) : full;
}

/**
 * Every new account: 5 free credits, about $10 of our cost at most (~$1.75 a credit at worst, ~$0.50 typically).
 * Videos made before the first purchase carry the watermark.
 */
export const TRIAL_CREDITS = 5;

/**
 * One-time credit packs. `credits` is everything the buyer gets, `bonus` of it on top ("10 + 2 bonus"). The web app maps
 * each key to a Dodo product (DODO_PRODUCT_<KEY>). Prices include tax everywhere (Dodo tax-inclusive pricing): India pays
 * the fixed rupee price by billing country (Localized Pricing), everyone else the USD price. Every pack divides evenly
 * into Studio videos, so no credits are ever stranded.
 * Measured cost (7 production Standard videos, Sept 2026): $0.90 a video on average, $1.66 at most. With every credit
 * used and no tax: USD packs keep 47–69% after Dodo's fee; India 22–42%. Watch /admin as volume grows.
 */
export const PACKS = {
  STARTER: { name: "Starter", credits: 3, bonus: 0, priceUsd: 12, priceInr: 599 },
  CREATOR: { name: "Creator", credits: 12, bonus: 2, priceUsd: 29, priceInr: 1999 },
  PRO: { name: "Pro", credits: 36, bonus: 6, priceUsd: 69, priceInr: 4999 },
} as const satisfies Record<string, { name: string; credits: number; bonus: number; priceUsd: number; priceInr: number }>;
export type PackKey = keyof typeof PACKS;

export type Currency = "usd" | "inr";
/** Countries that pay rupee prices. Dodo matches these by billing country at checkout, so the site shows them there too. */
export const INR_COUNTRIES = ["IN"];
export const packPrice = (key: PackKey, currency: Currency) => (currency === "inr" ? PACKS[key].priceInr : PACKS[key].priceUsd);
/** What one credit costs in a pack. */
export const perCredit = (key: PackKey, currency: Currency) => packPrice(key, currency) / PACKS[key].credits;

/**
 * Reel packs: reel credits that make reels only (the customer's own video, captioned and edited), one a reel up to 90
 * seconds and two up to 3 minutes (creditsForReel), priced for creators. A reel costs us about a cent of AI and a few
 * cents of compute, so ₹499 for 20 keeps most of it after Dodo's fee. Like the credit packs: a Dodo product each
 * (DODO_PRODUCT_<KEY>), the rupee price in India by billing country, dollars everywhere else, never expiring. A reel
 * uses reel credits first, then credits.
 */
export const REEL_PACKS = {
  REELS: { name: "Reel pack", reels: 20, priceUsd: 6, priceInr: 499 },
} as const satisfies Record<string, { name: string; reels: number; priceUsd: number; priceInr: number }>;
export type ReelPackKey = keyof typeof REEL_PACKS;
export const reelPackPrice = (key: ReelPackKey, currency: Currency) => (currency === "inr" ? REEL_PACKS[key].priceInr : REEL_PACKS[key].priceUsd);
/** For /admin's margin math only (Dodo converts at live rates): rupees per dollar, and the GST inside rupee prices. */
export const INR_PER_USD_ESTIMATE = 96;
export const INDIA_GST = 0.18;
/** How much cheaper a credit is than in the Starter pack, in whole percent, rounded down so it's never overstated. */
export const savingsPercent = (key: PackKey, currency: Currency) => Math.floor((1 - perCredit(key, currency) / perCredit("STARTER", currency)) * 100);

export function unitEconomics(job: { llmCostUsd: number | null; computeSeconds: number | null }) {
  const llm = job.llmCostUsd ?? 0;
  const compute = (job.computeSeconds ?? 0) * COMPUTE_USD_PER_SECOND;
  return { llm, compute, storage: STORAGE_USD_PER_VIDEO, total: llm + compute + STORAGE_USD_PER_VIDEO };
}
