// The reel editor's chat edits, asked of the render Worker (it holds the model key; the web app has none): through the
// REEL_ASSISTANT service binding in production, or the render Worker's dev route under `next dev`, like uploads.
import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AssistantAnswer = { reply: string; ops: unknown[]; inputTokens: number; outputTokens: number };

declare global {
  interface CloudflareEnv {
    REEL_ASSISTANT?: { chat(input: { context: string; message: string }): Promise<AssistantAnswer> };
  }
}

/** The assistant's answer, or null when there's none to ask here (demo mode without a local render Worker). */
export async function askAssistant(context: string, message: string): Promise<AssistantAnswer | null> {
  if (process.env.NODE_ENV === "development" && process.env.DEV_RENDER_URL) {
    const res = await fetch(`${process.env.DEV_RENDER_URL}/dev/reel-chat`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-dev-start-token": process.env.DEV_START_TOKEN ?? "" },
      body: JSON.stringify({ context, message }),
    }).catch(() => null);
    if (!res?.ok) throw new Error(`The local render Worker didn't answer (${res?.status ?? "no answer"}). Is \`npm run dev:render\` running?`);
    return (await res.json()) as AssistantAnswer;
  }
  const { env } = await getCloudflareContext({ async: true });
  return env.REEL_ASSISTANT ? env.REEL_ASSISTANT.chat({ context, message }) : null;
}
