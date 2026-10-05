// The reel editor's chat edits and stock B-roll searches, asked of the render Worker (it holds the model and Pexels keys;
// the web app has none): through the REEL_ASSISTANT service binding in production, or the render Worker's dev routes
// under `next dev`, like uploads.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AssistantAnswer = { reply: string; ops: unknown[]; inputTokens: number; outputTokens: number };
/** Pexels clips for a search (checked again by the caller), or why there are none (503 not set up, 429 busy, 502 failed). */
export type StockAnswer = { clips: unknown[]; error?: string; status?: number };

declare global {
  interface CloudflareEnv {
    REEL_ASSISTANT?: {
      chat(input: { context: string; message: string }): Promise<AssistantAnswer>;
      searchBroll(input: { query: string; portrait: boolean }): Promise<StockAnswer>;
    };
  }
}

async function askDevRender<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${process.env.DEV_RENDER_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-dev-start-token": process.env.DEV_START_TOKEN ?? "" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res?.ok) throw new Error(`The local render Worker didn't answer (${res?.status ?? "no answer"}). Is \`npm run dev:render\` running?`);
  return (await res.json()) as T;
}

/** The assistant's answer, or null when there's none to ask here (demo mode without a local render Worker). */
export async function askAssistant(context: string, message: string): Promise<AssistantAnswer | null> {
  if (process.env.NODE_ENV === "development" && process.env.DEV_RENDER_URL) return askDevRender<AssistantAnswer>("/dev/reel-chat", { context, message });
  const { env } = await getCloudflareContext({ async: true });
  return env.REEL_ASSISTANT ? env.REEL_ASSISTANT.chat({ context, message }) : null;
}

/** Stock footage for a search (Pexels, in the reel's orientation), or null when there's none to ask here. */
export async function searchStock(query: string, portrait: boolean): Promise<StockAnswer | null> {
  if (process.env.NODE_ENV === "development" && process.env.DEV_RENDER_URL) return askDevRender<StockAnswer>("/dev/broll-search", { query, portrait });
  const { env } = await getCloudflareContext({ async: true });
  return env.REEL_ASSISTANT ? env.REEL_ASSISTANT.searchBroll({ query, portrait }) : null;
}
