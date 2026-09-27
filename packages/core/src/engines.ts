// Engine rules shared by the render Worker and the runner. No Prisma here: the container imports it.
import type { Engine } from "./contract";

export const ENGINES: readonly Engine[] = ["claude", "openai"];

export function parseEngine(value: string | undefined, fallback: Engine = "claude"): Engine {
  return value === "claude" || value === "openai" ? value : fallback;
}

/**
 * Failures caused by the model provider (bad key, rate limit, outage) are worth retrying once on the
 * other engine. Creative failures (the agent couldn't make a good video) are not: retrying those would
 * only double the cost.
 */
export function isProviderFailure(error: string | null | undefined): boolean {
  if (!error) return false;
  return /\b(401|403|429|500|502|503|504|529)\b|authenticat|api key|invalid.{0,20}key|unauthori[sz]ed|rate.?limit|overloaded|quota|credit balance|billing|insufficient|service unavailable|ECONNRESET|ENOTFOUND|ETIMEDOUT|stream disconnected/i.test(error);
}

/** Removes anything that looks like an API key or GitHub token. Providers echo masked keys in their errors (OpenAI does). */
export function redactSecrets(text: string): string {
  return text
    .replace(/\b(?:sk|rk|pk)-[A-Za-z0-9_*.-]{4,}/g, "[key]")
    .replace(/\b(?:github_pat_[A-Za-z0-9_]{10,}|gh[pousr]_[A-Za-z0-9]{10,})/g, "[token]");
}

/** What a customer sees when a render fails. The technical error stays in the database for support. */
export function customerError(error: string | null | undefined): string {
  if (!error) return "Something went wrong while making this video.";
  if (/private repository/i.test(error)) return "We couldn't open your private repository. Check that your saved GitHub token can read it (Settings → Private repositories).";
  if (isProviderFailure(error)) return "Our AI provider had a problem, so this video couldn't be made. Please try again in a few minutes.";
  if (/took too long|timed out/i.test(error)) return "This video took too long to make. Please try again.";
  if (/max turns|max steps|cost ceiling|budget/i.test(error)) return "This video was too complex to finish. Try again with simpler notes.";
  return "Something went wrong while making this video. Please try again.";
}
