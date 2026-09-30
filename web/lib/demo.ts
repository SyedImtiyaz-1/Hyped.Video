import type { CreditEntry, Job, User } from "@launchreel/core";

/**
 * Demo mode renders the dashboard with sample data: no database, Clerk or Dodo needed.
 * Development only. It can never switch on in a production build.
 */
export const isDemo = process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

// The sample data is rebuilt on every call, so the timeline stays relative to the current time. (A
// module-level "now" froze when the dev server loaded this file, and the sample render looked stuck.)
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const DEMO_USER_ID = "demo_user";
// Sample videos from the open-source brag project's example gallery (MIT), used only in demo mode.
const SAMPLE = "https://latent-spaces.github.io/brag/examples";

export const demoUser = (): User => ({
  id: DEMO_USER_ID,
  email: "you@example.com",
  credits: 14, // the demo ledger: 5 trial + 3 + 12 bought + 1 refunded − 7 used
  plan: "FREE",
  billingCustomerId: "cus_demo",
  billingSubscriptionId: null,
  createdAt: ago(60 * 24 * 21),
});

function job(fields: Partial<Job> & Pick<Job, "id" | "status" | "sourceType" | "sourceUrl" | "createdAt">): Job {
  return {
    userId: DEMO_USER_ID, tone: null, format: "landscape", durationSec: 20, notes: null, parentJobId: null,
    creditsCost: 1, watermark: false, privateRepo: false, videoType: "launch", music: "upbeat", brief: null, quality: "standard", voice: null, captions: true, template: null, kind: "video", reel: null, captionsUrl: null, videoUrl: null, posterUrl: null, shareCopy: null, plan: null, error: null,
    model: "claude-opus-5-5", numTurns: null, inputTokens: null, outputTokens: null, cacheReadTokens: null,
    cacheWriteTokens: null, llmCostUsd: null, computeSeconds: null, attempts: 1, startedAt: null, finishedAt: null,
    ...fields,
  };
}

const TAXI_PLAN = `# Taxi for Taxis: launch video plan

Angle: a deadpan startup launch for a service that drives taxis home.

Hook (0-3s)        "Who drives the taxi home?"
Reveal (3-6s)      Logo and tagline slide in over the booking screen
Highlight 1 (6-10s)   Book a ride: the real booking flow, typed live
Highlight 2 (10-14s)  A taxi picks up a taxi (the app's own illustration)
Highlight 3 (14-17s)  Five-star review, written by a cab
Outro (17-20s)     "Taxi for Taxis. Launching today." + URL

Tone: yc-parody | Format: 1920x1080, 30fps | Music: upbeat, ~118 BPM`;

export const demoJobs = (): Job[] => [
  job({ id: "cmgk2h8n4orbit01", status: "RUNNING", sourceType: "WEBSITE", sourceUrl: "https://orbitnotes.app", tone: "polished", createdAt: ago(6), startedAt: ago(5) }),
  job({ id: "cmgk2h9q1rocket2", status: "QUEUED", sourceType: "GITHUB", sourceUrl: "https://github.com/acme/rocket-cli", tone: "yc-parody", format: "vertical", createdAt: ago(1) }),
  job({
    id: "cmgk1z7taxirev03", status: "SUCCEEDED", sourceType: "WEBSITE", sourceUrl: "https://taxifortaxis.com", tone: "yc-parody",
    parentJobId: "cmgk1x2taxi00004", notes: "Punchier hook, and end on the pricing line", creditsCost: 1,
    videoUrl: `${SAMPLE}/taxi-for-taxis/brag.mp4`, posterUrl: `${SAMPLE}/taxi-for-taxis/brag.jpg`,
    shareCopy: "Taxis have driven everyone else around for a century. Taxi for Taxis finally gives them a ride home. Launching today.",
    plan: TAXI_PLAN, createdAt: ago(70), startedAt: ago(69), finishedAt: ago(63), computeSeconds: 372, numTurns: 31, llmCostUsd: 1.74,
  }),
  job({
    id: "cmgk1x2taxi00004", status: "SUCCEEDED", sourceType: "WEBSITE", sourceUrl: "https://taxifortaxis.com", tone: "yc-parody",
    videoUrl: `${SAMPLE}/taxi-for-taxis/brag.mp4`, posterUrl: `${SAMPLE}/taxi-for-taxis/brag.jpg`,
    shareCopy: "Taxis have driven everyone else around for a century. Taxi for Taxis finally gives them a ride home.",
    plan: TAXI_PLAN, createdAt: ago(95), startedAt: ago(94), finishedAt: ago(81), computeSeconds: 783, numTurns: 72, llmCostUsd: 3.62,
  }),
  job({
    id: "cmgjzr4horse0005", status: "SUCCEEDED", sourceType: "WEBSITE", sourceUrl: "https://horsetinder.app", tone: "default",
    videoUrl: `${SAMPLE}/horse-tinder/brag.mp4`, posterUrl: `${SAMPLE}/horse-tinder/brag.jpg`,
    shareCopy: "Swipe right on your next stable relationship. Horse Tinder is live.",
    createdAt: ago(60 * 26), startedAt: ago(60 * 26 - 1), finishedAt: ago(60 * 26 - 17), computeSeconds: 962, numTurns: 88, llmCostUsd: 4.41,
  }),
  job({
    id: "cmgjyq8pixel0006", status: "FAILED", sourceType: "WEBSITE", sourceUrl: "https://pixelpal.io", tone: "chaotic", format: "square",
    error: "Hit per-video cost ceiling", createdAt: ago(60 * 30), startedAt: ago(60 * 30 - 1), finishedAt: ago(60 * 30 - 24), computeSeconds: 1386, numTurns: 150, llmCostUsd: 8,
  }),
  job({
    id: "cmgjw1bfish00007", status: "SUCCEEDED", sourceType: "WEBSITE", sourceUrl: "https://fishflightschool.com", tone: "cinematic",
    videoUrl: `${SAMPLE}/fish-flight-school/brag.mp4`, posterUrl: `${SAMPLE}/fish-flight-school/brag.jpg`,
    shareCopy: "Fish Flight School: because evolution was taking too long. Enrollment is open.",
    createdAt: ago(60 * 24 * 3), startedAt: ago(60 * 24 * 3 - 1), finishedAt: ago(60 * 24 * 3 - 15), computeSeconds: 874, numTurns: 69, llmCostUsd: 3.9,
  }),
];

const entry = (id: string, delta: number, reason: string, minutesAgo: number): CreditEntry => ({
  id, userId: DEMO_USER_ID, delta, reason, paymentRef: null, createdAt: ago(minutesAgo),
});

// Sums to demoUser.credits (11).
export const demoLedger = (): CreditEntry[] => [
  entry("l11", -1, "job:cmgk2h9q1rocket2", 1),
  entry("l10", -1, "job:cmgk2h8n4orbit01", 6),
  entry("l09", -1, "job:cmgk1z7taxirev03", 70),
  entry("l08", -1, "job:cmgk1x2taxi00004", 95),
  entry("l07", -1, "job:cmgjzr4horse0005", 60 * 26),
  entry("l06", 1, "refund:cmgjyq8pixel0006", 60 * 30 - 24),
  entry("l05", -1, "job:cmgjyq8pixel0006", 60 * 30),
  entry("l04", -1, "job:cmgjw1bfish00007", 60 * 24 * 3),
  entry("l03", 12, "purchase:CREATOR", 60 * 24 * 7),
  entry("l02", 3, "purchase:STARTER", 60 * 24 * 14),
  entry("l01", 5, "signup_trial", 60 * 24 * 21),
];
