// Render Worker: turns a queued job into a video.
//
// One durable Workflow per job drives one throwaway Sandbox container running the brag-slim agent on
// the configured engine: Claude (Claude Agent SDK) or OpenAI (Codex CLI). If the primary engine fails
// because of its provider (bad key, rate limit, outage), the job is retried once on the fallback engine.
// Every step is safe to retry. Whatever happens, the job ends SUCCEEDED or FAILED-and-refunded, and
// the container is destroyed.
//
// No secrets enter the container: model calls go to virtual hosts that this Worker answers, adding the
// real key on the way out. The database is only reachable from this Worker (Hyperdrive), and files move
// through R2 bindings.
import { getSandbox, Sandbox } from "@cloudflare/sandbox";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { createDb, grantCredits, isProviderFailure, LONG_VIDEO_SECONDS, openToken, parseEngine, parseSealedToken, redactSecrets, type Engine, type JobResult, type JobSpec, type RepoTokenJwk } from "@launchreel/core";

// Required for egress interception: the platform routes intercepted traffic through this entrypoint.
export { ContainerProxy } from "@cloudflare/sandbox";

/** One container per video. */
export class VideoSandbox extends Sandbox<Env> {}

// Virtual hosts: they never leave Cloudflare and need no TLS trust inside the container.
const ANTHROPIC_HOST = "anthropic.internal";
const OPENAI_HOST = "openai.internal";

/** Forward a model call from the container to the real API, with the real key added here. */
function forward(request: Request, origin: string, key: string | undefined, name: string, setAuth: (h: Headers, key: string) => void) {
  if (!key) {
    return Response.json({ error: { type: "authentication_error", message: `401 ${name} is not set on the render Worker` } }, { status: 401 });
  }
  const url = new URL(request.url);
  const upstream = new Request(`${origin}${url.pathname}${url.search}`, request);
  setAuth(upstream.headers, key);
  upstream.headers.delete("host");
  return fetch(upstream);
}

// Claude Code calls http://anthropic.internal (ANTHROPIC_BASE_URL); Codex calls http://openai.internal/v1.
// Everything else the agent fetches (the customer's site, GitHub, fonts) goes out untouched.
//
// Assigned rather than declared as a static class field: the setter registers the handlers under the
// class name, which is how the egress proxy finds them. A class field would silently skip registration.
VideoSandbox.outboundByHost = {
  [ANTHROPIC_HOST]: (request: Request, env: Env) =>
    forward(request, "https://api.anthropic.com", env.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY", (h, key) => {
      h.set("x-api-key", key);
      h.delete("authorization");
    }),
  [OPENAI_HOST]: (request: Request, env: Env) =>
    forward(request, "https://api.openai.com", env.OPENAI_API_KEY, "OPENAI_API_KEY", (h, key) => {
      h.set("authorization", `Bearer ${key}`);
      h.delete("x-api-key");
    }),
};

type Params = { jobId: string };

const POLL_EVERY = "45 seconds";
const POLL_SECONDS = 45;
const MAX_POLLS = 60; // ~45 minutes per engine attempt, then the render is stopped
const MAX_POLLS_LONG = 120; // ~90 minutes for 60–90s launch videos
const STALE_RUNNING_MINUTES = 210; // longer than two long attempts, so the cron never races a live job
const MAX_REPO_BYTES = 500 * 1024 * 1024; // private repo downloads

/** Passes a stream through, failing it once more than `max` bytes have gone by. */
function limitBytes(max: number) {
  let seen = 0;
  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      seen += chunk.byteLength;
      if (seen > max) controller.error(new Error(`Private repository: the download is over ${max / 1024 / 1024} MB`));
      else controller.enqueue(chunk);
    },
  });
}

const sandboxFor = (env: Env, jobId: string) =>
  // Container sleeps after 15 idle minutes, so an orphaned render can't run up a bill.
  getSandbox(env.Sandbox, jobId.toLowerCase(), { sleepAfter: "15m" });

/** Primary engine first, then the fallback (if set and different). Engines without an API key are skipped. */
function engineOrder(env: Env): Engine[] {
  const primary = parseEngine(env.ENGINE, "claude");
  const fallback = env.ENGINE_FALLBACK ? parseEngine(env.ENGINE_FALLBACK, primary) : primary;
  const order: Engine[] = fallback === primary ? [primary] : [primary, fallback];
  const withKey = order.filter((e) => (e === "openai" ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY));
  return withKey.length ? withKey : [primary]; // no key at all: run anyway, so the job fails with a clear 401
}

/** Free videos use each provider's cheaper model; paid videos the better one. */
function modelFor(env: Env, engine: Engine, free: boolean): string {
  if (engine === "openai") return free ? env.OPENAI_MODEL_FREE : env.OPENAI_MODEL_PAID;
  return free ? env.CLAUDE_MODEL_FREE : env.CLAUDE_MODEL_PAID;
}

export class VideoJobWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { jobId } = event.payload;

    const job = await step.do("claim job", async () => {
      const db = createDb(this.env.HYPERDRIVE.connectionString);
      const j = await db.job.findUnique({ where: { id: jobId }, include: { user: { select: { plan: true } } } });
      if (!j) throw new NonRetryableError(`Job ${jobId} not found`);
      if (j.status === "SUCCEEDED" || j.status === "FAILED") return null; // duplicate start
      await db.job.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: j.startedAt ?? new Date(), attempts: { increment: 1 } } });
      return {
        userId: j.userId,
        sourceType: j.sourceType,
        sourceUrl: j.sourceUrl,
        tone: j.tone,
        format: j.format,
        durationSec: j.durationSec,
        notes: j.notes,
        parentJobId: j.parentJobId,
        watermark: j.watermark,
        creditsCost: j.creditsCost,
        privateRepo: j.privateRepo,
        // A trial video (watermarked: no credits ever bought). Pack buyers stay on the FREE plan but get full videos.
        free: j.watermark,
      };
    });
    if (!job) return;

    // Decided once and cached, so a config change in the middle of a render can't reshuffle the attempts.
    const engines = await step.do("pick engines", async () => engineOrder(this.env));

    // 60–90s launch videos get twice the turns, 2.5x the budget and twice the time.
    const long = !job.free && job.durationSec > LONG_VIDEO_SECONDS;
    const maxPolls = long ? MAX_POLLS_LONG : MAX_POLLS;

    // Metering is summed across engine attempts: a failed first attempt still cost tokens.
    const totals = { model: "", numTurns: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, llmCostUsd: 0, computeSeconds: 0 };
    let outcome: { ok: boolean; error: string | null; videoUrl: string | null; posterUrl: string | null; shareCopy: string | null; plan: string | null } | null = null;

    try {
      for (const [attemptIndex, engine] of engines.entries()) {
        const processId = `render-${engine}`;
        const hasFallback = attemptIndex < engines.length - 1;

        await step.do(`start ${engine}`, { retries: { limit: 3, delay: "30 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
          // Private repos are downloaded here, before any container starts, so a bad token fails fast and free.
          const source = job.privateRepo ? await this.downloadPrivateRepo(job.userId, job.sourceUrl) : null;
          const sandbox = sandboxFor(this.env, jobId);
          if (await sandbox.getProcess(processId)) {
            await source?.cancel(); // a previous attempt of this step already started it
            return;
          }
          await sandbox.exec("rm -rf /workspace/project /workspace/out /workspace/result.json /workspace/parent.tgz /workspace/source.tgz");

          const spec: JobSpec = {
            jobId,
            request: {
              source: { type: job.sourceType, url: job.sourceUrl },
              tone: job.tone,
              format: job.format,
              // Free videos are capped at 15s and use the cheaper model: our acquisition cost.
              durationSec: job.free ? Math.min(job.durationSec, 15) : job.durationSec,
              notes: job.parentJobId ? null : job.notes,
              revisionOf: job.parentJobId ? job.notes : null,
            },
            engine,
            model: modelFor(this.env, engine, job.free),
            watermark: job.watermark,
            watermarkText: `Made with ${this.env.BRAND_NAME}`,
            hasParentWorkspace: false,
            hasSourceArchive: false,
          };
          if (source) {
            await sandbox.writeFile("/workspace/source.tgz", source);
            spec.hasSourceArchive = true;
          }
          if (job.parentJobId) {
            // Revisions continue from the parent's plan and composition instead of starting over.
            const parent = await this.env.VIDEOS.get(`jobs/${job.parentJobId}/workspace.tgz`);
            if (parent) {
              await sandbox.writeFile("/workspace/parent.tgz", parent.body);
              spec.hasParentWorkspace = true;
            }
          }
          await sandbox.writeFile("/workspace/job.json", JSON.stringify(spec));
          await sandbox.exec("chown -R agent:agent /workspace");
          await sandbox.startProcess("runuser -u agent -- node /app/dist/run-job.mjs", {
            processId,
            cwd: "/workspace",
            env: {
              HOME: "/home/agent",
              JOB_ROOT: "/workspace",
              // Model calls go to this Worker's virtual hosts, which swap in the real keys outside the container.
              ANTHROPIC_BASE_URL: `http://${ANTHROPIC_HOST}`,
              ANTHROPIC_API_KEY: "added-by-worker",
              OPENAI_BASE_URL: `http://${OPENAI_HOST}/v1`,
              OPENAI_API_KEY: "added-by-worker",
              CODEX_HOME: "/home/agent/.codex",
              CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", // no telemetry or update checks from the container
              IS_SANDBOX: "1",
              // Claude Code retries API errors ~10 times (about 3 minutes, even for a rejected key). With another
              // engine to fall back to, 6 retries (~40s) still rides out a short overload but fails over sooner.
              ...(hasFallback ? { CLAUDE_CODE_MAX_RETRIES: "6" } : {}),
              CLAUDE_EFFORT: this.env.CLAUDE_EFFORT,
              // A fallback attempt only gets what the first attempt left of the budget (at least $1).
              MAX_COST_PER_JOB_USD: Math.max(1, (Number(this.env.MAX_COST_PER_JOB_USD) || 8) * (long ? 2.5 : 1) - totals.llmCostUsd).toFixed(2),
              MAX_TURNS: String((Number(this.env.MAX_TURNS) || 150) * (long ? 2 : 1)),
              // The runner stops its agent 5 minutes before the workflow would give up on it.
              JOB_TIMEOUT_MS: String((maxPolls * POLL_SECONDS - 300) * 1000),
              PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
            },
          });
        });

        // Each check is a request to the container, which also keeps it from idling out while it works.
        let finished = false;
        for (let i = 0; i < maxPolls && !finished; i++) {
          await step.sleep(`wait ${engine} ${i}`, POLL_EVERY);
          finished = await step.do(`check ${engine} ${i}`, async () => {
            const proc = await sandboxFor(this.env, jobId).getProcess(processId);
            return !proc || !(proc.status === "running" || proc.status === "starting");
          });
        }
        if (!finished) {
          await step.do(`stop ${engine}`, async () => {
            await sandboxFor(this.env, jobId).killProcess(processId).catch(() => {});
          });
        }

        const attempt = await step.do(`collect ${engine}`, { retries: { limit: 3, delay: "20 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
          const sandbox = sandboxFor(this.env, jobId);
          const result = await sandbox
            .readFile("/workspace/result.json")
            .then((f) => JSON.parse(f.content) as JobResult)
            .catch(() => null);
          if (!result) {
            return { ok: false, error: finished ? "The render stopped without a result" : "The render took too long", videoUrl: null, posterUrl: null, shareCopy: null, plan: null, metering: null };
          }
          let videoUrl: string | null = null;
          let posterUrl: string | null = null;
          if (result.ok && result.files.video) {
            videoUrl = await this.store(sandbox, result.files.video, `jobs/${jobId}/brag.mp4`, "video/mp4");
            if (result.files.poster) posterUrl = await this.store(sandbox, result.files.poster, `jobs/${jobId}/brag.jpg`, "image/jpeg");
            if (result.files.workspace) await this.store(sandbox, result.files.workspace, `jobs/${jobId}/workspace.tgz`, "application/gzip");
          }
          return {
            ok: Boolean(result.ok && videoUrl),
            error: result.ok && videoUrl ? null : (result.error ?? "Render failed"),
            videoUrl,
            posterUrl,
            shareCopy: result.shareCopy,
            plan: result.plan,
            metering: {
              model: result.model,
              numTurns: result.numTurns,
              inputTokens: result.usage.input,
              outputTokens: result.usage.output,
              cacheReadTokens: result.usage.cacheRead,
              cacheWriteTokens: result.usage.cacheWrite,
              llmCostUsd: result.sdkReportedCostUsd || result.llmCostUsd,
              computeSeconds: Math.round(result.durationMs / 1000),
            },
          };
        });

        const { metering, ...rest } = attempt;
        outcome = rest;
        if (metering) {
          totals.model = metering.model;
          totals.numTurns += metering.numTurns;
          totals.inputTokens += metering.inputTokens;
          totals.outputTokens += metering.outputTokens;
          totals.cacheReadTokens += metering.cacheReadTokens;
          totals.cacheWriteTokens += metering.cacheWriteTokens;
          totals.llmCostUsd += metering.llmCostUsd;
          totals.computeSeconds += metering.computeSeconds;
        }
        // Only a provider problem (not a creative failure or a timeout) is worth a second engine.
        if (outcome.ok || !finished || !isProviderFailure(outcome.error)) break;
      }

      await step.do("finish job", async () => {
        const db = createDb(this.env.HYPERDRIVE.connectionString);
        const metering = { ...(totals.model ? totals : {}), finishedAt: new Date() };
        if (outcome?.ok) {
          await db.job.update({
            where: { id: jobId },
            data: { ...metering, status: "SUCCEEDED", videoUrl: outcome.videoUrl, posterUrl: outcome.posterUrl, shareCopy: outcome.shareCopy, plan: outcome.plan },
          });
        } else {
          await db.job.update({ where: { id: jobId }, data: { ...metering, status: "FAILED", error: redactSecrets(outcome?.error ?? "Render failed").slice(0, 2000) } });
          await grantCredits(db, job.userId, job.creditsCost, `refund:${jobId}`, `refund:${jobId}`);
        }
      });
    } catch (err) {
      // A step ran out of retries: fail the job and give the credits back.
      await step.do("fail and refund", async () => {
        const db = createDb(this.env.HYPERDRIVE.connectionString);
        await db.job.update({ where: { id: jobId }, data: { status: "FAILED", error: redactSecrets(`Render error: ${String(err)}`).slice(0, 500), finishedAt: new Date() } });
        await grantCredits(db, job.userId, job.creditsCost, `refund:${jobId}`, `refund:${jobId}`);
      });
    }

    await step.do("destroy sandbox", async () => {
      await sandboxFor(this.env, jobId).destroy();
    });
  }

  /**
   * Downloads a private repo with the customer's saved GitHub token. The token is decrypted here, used for one
   * request to GitHub and dropped: it never reaches the container, a workflow step result or a log.
   */
  private async downloadPrivateRepo(userId: string, repoUrl: string): Promise<ReadableStream<Uint8Array>> {
    const db = createDb(this.env.HYPERDRIVE.connectionString);
    const saved = await db.repoToken.findUnique({ where: { userId } });
    if (!saved) throw new NonRetryableError("Private repository: no GitHub token is saved (Settings → Private repositories)");
    let token: string;
    try {
      const sealed = parseSealedToken(JSON.parse(saved.sealed));
      if (!sealed || !this.env.REPO_TOKEN_PRIVATE_KEY) throw new Error("unreadable");
      token = await openToken(sealed, userId, JSON.parse(this.env.REPO_TOKEN_PRIVATE_KEY) as RepoTokenJwk);
    } catch {
      throw new NonRetryableError("Private repository: the saved GitHub token can't be read. Add it again in Settings.");
    }
    const [, owner, name] = new URL(repoUrl).pathname.split("/");
    const repo = `${owner}/${(name ?? "").replace(/\.git$/, "")}`;
    // GitHub answers with a redirect to a short-lived download link, which fetch follows without the token.
    const res = await fetch(`https://api.github.com/repos/${repo}/tarball`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "launchreel-render" },
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new NonRetryableError(`Private repository: GitHub answered ${res.status}. Check that your saved token can read ${repo}.`);
    }
    if (!res.ok || !res.body) throw new Error(`Private repository: GitHub download failed (${res.status})`);
    await db.repoToken.update({ where: { userId }, data: { lastUsedAt: new Date() } });
    return res.body.pipeThrough(limitBytes(MAX_REPO_BYTES));
  }

  /** Streams a file out of the container into R2 and returns its public URL. */
  private async store(sandbox: ReturnType<typeof sandboxFor>, relativePath: string, key: string, contentType: string) {
    const file = await sandbox.readFile(`/workspace/${relativePath}`, { encoding: "none" });
    // R2 needs the length up front; FixedLengthStream provides it without buffering the whole video.
    const body = file.content.pipeThrough(new FixedLengthStream(file.size));
    await this.env.VIDEOS.put(key, body, { httpMetadata: { contentType } });
    return `${this.env.PUBLIC_VIDEO_BASE_URL}/${key}`;
  }
}

export default {
  async fetch() {
    return new Response("render worker: ok");
  },

  // Safety net: if a workflow died without finishing, fail and refund the job and free its container.
  async scheduled(_controller: ScheduledController, env: Env) {
    const db = createDb(env.HYPERDRIVE.connectionString);
    const stale = await db.job.findMany({
      where: {
        OR: [
          { status: "RUNNING", startedAt: { lt: new Date(Date.now() - STALE_RUNNING_MINUTES * 60_000) } },
          { status: "QUEUED", createdAt: { lt: new Date(Date.now() - 30 * 60_000) } },
        ],
      },
      take: 50,
    });
    for (const job of stale) {
      await db.job.update({ where: { id: job.id }, data: { status: "FAILED", error: "Render timed out", finishedAt: new Date() } });
      await grantCredits(db, job.userId, job.creditsCost, `refund:${job.id}`, `refund:${job.id}`);
      await sandboxFor(env, job.id).destroy().catch(() => {});
    }
  },
} satisfies ExportedHandler<Env>;
