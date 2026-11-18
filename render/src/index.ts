// Render Worker: turns a queued job into a video.
//
// One durable Workflow per job drives one throwaway Sandbox container running the brag-slim agent on
// the engine of the job's quality tier (Standard or Studio): Claude (Claude Agent SDK) or OpenAI (Codex
// CLI), mapped in wrangler.jsonc. There is no fallback between engines. Every step is safe to retry. Whatever happens, the job ends SUCCEEDED or FAILED-and-refunded, and
// the container is destroyed.
//
// No secrets enter the container: model calls go to virtual hosts that this Worker answers, adding the
// real key on the way out. The database is only reachable from this Worker (Hyperdrive), and files move
// through R2 bindings.
//
// Reels (job.kind "reel") take the same route with no agent: the customer's upload goes from R2 into the container,
// where runner/src/reel.ts captions and edits it in a few minutes.
import { getSandbox, Sandbox } from "@cloudflare/sandbox";
import { WorkerEntrypoint, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { NonRetryableError } from "cloudflare:workflows";
import { sendFailureAlert, sendJobEmail } from "./email";
import {
  createDb,
  grantCredits,
  LONG_VIDEO_SECONDS,
  openToken,
  changeFiles,
  fetchChangeFacts,
  GithubApiError,
  parseGithubSource,
  parseEngine,
  parseReel,
  parseSealedToken,
  redactSecrets,
  REEL_PLAN_MODEL,
  CHAT_SCHEMA,
  chatMessages,
  cleanProjectChat,
  parseProjectAnswer,
  projectChatRequest,
  type ProjectAnswer,
  BROLL_SOURCES,
  parseClip,
  stockClips,
  stockSearchUrl,
  type BrollClip,
  type BrollSource,
  REEL_UPLOAD_TYPES,
  reelSecondsFor,
  sourceKey,
  videoOptions,
  voiceKey,
  type Engine,
  type JobResult,
  type JobSpec,
  type ReelExport,
  type ReelJob,
  type ReelSpec,
  type RepoTokenJwk,
} from "@launchreel/core";

// Required for egress interception: the platform routes intercepted traffic through this entrypoint.
export { ContainerProxy } from "@cloudflare/sandbox";

/** One container per video. */

/** The balance a job was paid from, for its refund (jobs from before reel packs paid with credits). */
const balanceOf = (paidWith: string | undefined): "credits" | "reels" => (paidWith === "reels" ? "reels" : "credits");
export class VideoSandbox extends Sandbox<Env> {}

// Virtual hosts: they never leave Cloudflare and need no TLS trust inside the container.
const ANTHROPIC_HOST = "anthropic.internal";
const OPENAI_HOST = "openai.internal";
// Word timings for voiceover captions: speech recognition on Workers AI, so the audio never leaves Cloudflare.
const TIMINGS_HOST = "timings.internal";
// Stock B-roll searches for reels: answered here (searchBroll, with this Worker's key and cache); the footage itself
// downloads from the library's public URLs.
const BROLL_HOST = "broll.internal";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Word timings for a recording (POSTed as audio bytes): Workers AI Whisper, flattened to words. English unless
 * x-hyped-language names another language or "auto" (reels); x-hyped-vad: 1 skips silence first.
 */
async function wordTimings(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const audio = new Uint8Array(await request.arrayBuffer());
  if (!audio.byteLength || audio.byteLength > 20 * 1024 * 1024) return Response.json({ error: "Send up to 20 MB of audio" }, { status: 413 });
  const prompt = decodeURIComponent(request.headers.get("x-hyped-prompt") ?? "").slice(0, 800);
  const asked = request.headers.get("x-hyped-language");
  const language = asked === "auto" ? undefined : asked && /^[a-z]{2}$/.test(asked) ? asked : "en";
  const out = await env.AI.run("@cf/openai/whisper-large-v3-turbo", {
    audio: toBase64(audio),
    ...(language ? { language } : {}),
    ...(request.headers.get("x-hyped-vad") === "1" ? { vad_filter: true } : {}),
    ...(prompt ? { initial_prompt: prompt } : {}),
  });
  const words = (out.segments ?? []).flatMap((seg) => (seg.words ?? []).map((w) => ({ word: w.word ?? "", start: w.start ?? 0, end: w.end ?? 0 })));
  return Response.json({ words, language: out.transcription_info?.language ?? language ?? null });
}

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
  [TIMINGS_HOST]: (request: Request, env: Env) => wordTimings(request, env),
  [BROLL_HOST]: async (request: Request, env: Env) => {
    const url = new URL(request.url);
    return Response.json(await searchBroll(env, { query: url.searchParams.get("query") ?? "", portrait: url.searchParams.get("portrait") === "1" }));
  },
};

/**
 * A job to run, or (`export`) a re-export of an edited reel or product video: its revision, in Job.reel.export; or
 * (`prepare`) an older product video made ready to edit (revision 0).
 */
type Params = { jobId: string; export?: number; prepare?: boolean };

/** A product video's longest edit: far past the 90 s they're made at, so cut-free re-exports never trip it. */
const VIDEO_MAX_SECONDS = 30 * 60;

/** What the runner takes of a reel's options (Job.reel holds the upload and the export too). */
const reelOptions = (reel: ReelJob): ReelSpec["options"] => ({
  style: reel.style,
  look: reel.look,
  fonts: reel.fonts,
  emojis: reel.emojis,
  zooms: reel.zooms,
  sfx: reel.sfx,
  hook: reel.hook,
  broll: reel.broll,
  language: reel.language,
  cleanup: reel.cleanup,
  editStyle: reel.editStyle,
  strength: reel.strength,
  ...(reel.captions === false ? { captions: false } : {}),
});

/** Job.reel for a product video made editable: its starting options, the clean copy as its upload, and what's in it. */
function videoReel(jobId: string, source: NonNullable<JobResult["source"]>, exported?: ReelExport): ReelJob {
  return {
    ...videoOptions(source.captions, source.accent),
    key: sourceKey(jobId),
    fileName: "video.mp4",
    bytes: source.bytes,
    durationSec: source.duration,
    width: source.width,
    height: source.height,
    video: { burned: source.burned, watermarked: source.watermarked, narrated: source.narrated, voice: source.voice },
    ...(exported ? { export: exported } : {}),
  };
}

const POLL_EVERY = "45 seconds";
const POLL_SECONDS = 45;
const MAX_POLLS = 60; // ~45 minutes per engine attempt, then the render is stopped
const MAX_POLLS_LONG = 120; // ~90 minutes for 60–90s launch videos
const STALE_RUNNING_MINUTES = 210; // longer than two long attempts, so the cron never races a live job
const MAX_REPO_BYTES = 500 * 1024 * 1024; // private repo downloads
// Reels take 1-3 minutes, so they're checked more often and stopped sooner.
const REEL_POLL_EVERY = "20 seconds";
const REEL_MAX_POLLS = 75; // ~25 minutes, for reels up to 3 minutes
/** Polls for a reel of this length: ~25 minutes, plus ~4 minutes per minute of video (up to 20 minutes: ~105 minutes). */
const reelPolls = (durationSec: number) => REEL_MAX_POLLS + Math.ceil(Math.max(0, durationSec - 180) / 60) * 12;

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

/** A stable number per customer (FNV-1a), so every customer's first video doesn't start on the same track. */
const seedFor = (userId: string) => [...userId].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261) % 997;

const sandboxFor = (env: Env, jobId: string) =>
  // Container sleeps after 15 idle minutes, so an orphaned render can't run up a bill.
  getSandbox(env.Sandbox, jobId.toLowerCase(), { sleepAfter: "15m" });

/** The engine and model behind a quality tier. Anything but "studio" is Standard (older jobs, free trials). */
function engineFor(env: Env, quality: string): { engine: Engine; model: string } {
  return quality === "studio"
    ? { engine: parseEngine(env.STUDIO_ENGINE, "claude"), model: env.STUDIO_MODEL }
    : { engine: parseEngine(env.STANDARD_ENGINE, "openai"), model: env.STANDARD_MODEL };
}

export class VideoJobWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { jobId } = event.payload;
    // A re-export runs beside the finished job, which keeps its status and video until the new one replaces it.
    if (event.payload.export) return this.exportReel(jobId, event.payload.export, step);
    if (event.payload.prepare) return this.prepareVideo(jobId, step);

    const job = await step.do("claim job", async () => {
      const db = createDb(this.env.HYPERDRIVE.connectionString);
      const j = await db.job.findUnique({ where: { id: jobId }, include: { user: { select: { plan: true } } } });
      if (!j) throw new NonRetryableError(`Job ${jobId} not found`);
      if (j.status === "SUCCEEDED" || j.status === "FAILED") return null; // duplicate start
      await db.job.update({ where: { id: jobId }, data: { status: "RUNNING", startedAt: j.startedAt ?? new Date(), attempts: { increment: 1 } } });
      // The music rotation moves one track on with each of this customer's videos (runner/src/music.ts).
      const earlier = j.kind === "video" ? await db.job.count({ where: { userId: j.userId, kind: "video", createdAt: { lt: j.createdAt } } }) : 0;
      return {
        musicSeed: seedFor(j.userId) + earlier,
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
        videoType: j.videoType,
        music: j.music,
        brief: j.brief,
        quality: j.quality,
        voice: j.voice,
        captions: j.captions,
        template: j.template,
        kind: j.kind,
        reel: j.reel,
        paidWith: j.paidWith,
      };
    });
    if (!job) return;
    if (job.kind === "reel") return this.reel(jobId, job, step);

    // Decided once and cached, so a config change in the middle of a render can't switch its engine.
    const { engine, model } = await step.do("pick engine", async () => engineFor(this.env, job.quality));

    // 60–90s launch videos get twice the turns, 2.5x the budget and twice the time.
    const long = job.durationSec > LONG_VIDEO_SECONDS;
    const maxPolls = long ? MAX_POLLS_LONG : MAX_POLLS;

    const processId = `render-${engine}`;

    try {
      await step.do(`start ${engine}`, { retries: { limit: 3, delay: "30 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
        // Private repos are downloaded here, before any container starts, so a bad token fails fast and free.
        const source = job.privateRepo ? await this.downloadPrivateRepo(job.userId, job.sourceUrl) : null;
        const sandbox = sandboxFor(this.env, jobId);
        if (await sandbox.getProcess(processId)) {
          await source?.archive.cancel(); // a previous attempt of this step already started it
          return;
        }
        await sandbox.exec("rm -rf /workspace/project /workspace/out /workspace/result.json /workspace/parent.tgz /workspace/source.tgz /workspace/change.json /workspace/change.diff");

        const spec: JobSpec = {
          jobId,
          request: {
            source: { type: job.sourceType as JobSpec["request"]["source"]["type"], url: job.sourceUrl }, // never UPLOAD: reels branch off above
            tone: job.tone,
            format: job.format,
            durationSec: job.durationSec,
            notes: job.parentJobId ? null : job.notes,
            revisionOf: job.parentJobId ? job.notes : null,
            videoType: job.videoType as JobSpec["request"]["videoType"],
            music: job.music as JobSpec["request"]["music"],
            brief: (job.brief ?? null) as JobSpec["request"]["brief"],
            voice: (job.voice ?? null) as JobSpec["request"]["voice"],
            captions: job.captions,
            template: job.template ?? null,
            musicSeed: job.musicSeed,
          },
          engine,
          model,
          watermark: job.watermark,
          watermarkText: `Made with ${this.env.BRAND_NAME}`,
          hasParentWorkspace: false,
          hasSourceArchive: false,
        };
        if (source) {
          await sandbox.writeFile("/workspace/source.tgz", source.archive);
          spec.hasSourceArchive = true;
          // A pull request, release or comparison: what GitHub says about it, for the runner's .hyped/change.json.
          if (source.change) {
            await sandbox.writeFile("/workspace/change.json", source.change.json);
            await sandbox.writeFile("/workspace/change.diff", source.change.diff);
            spec.hasChangeFacts = true;
          }
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
            CLAUDE_EFFORT: this.env.CLAUDE_EFFORT,
            MAX_COST_PER_JOB_USD: ((Number(this.env.MAX_COST_PER_JOB_USD) || 8) * (long ? 2.5 : 1)).toFixed(2),
            MAX_TURNS: String((Number(this.env.MAX_TURNS) || 150) * (long ? 2 : 1)),
            // The runner stops its agent 5 minutes before the workflow would give up on it.
            JOB_TIMEOUT_MS: String((maxPolls * POLL_SECONDS - 300) * 1000),
            PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
            HYPED_TIMINGS_URL: `http://${TIMINGS_HOST}/words`,
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
          return { ok: false, error: finished ? "The render stopped without a result" : "The render took too long", videoUrl: null, posterUrl: null, captionsUrl: null, shareCopy: null, plan: null, reel: null, metering: null };
        }
        let videoUrl: string | null = null;
        let posterUrl: string | null = null;
        let captionsUrl: string | null = null;
        let reel: ReelJob | null = null;
        if (result.ok && result.files.video) {
          videoUrl = await this.store(sandbox, result.files.video, `jobs/${jobId}/brag.mp4`, "video/mp4");
          if (result.files.poster) posterUrl = await this.store(sandbox, result.files.poster, `jobs/${jobId}/brag.jpg`, "image/jpeg");
          if (result.files.captions) captionsUrl = await this.store(sandbox, result.files.captions, `jobs/${jobId}/captions.srt`, "application/x-subrip");
          if (result.files.workspace) await this.store(sandbox, result.files.workspace, `jobs/${jobId}/workspace.tgz`, "application/gzip");
          // What the editor opens: the clean copy (the agent's video, no captions or mark), the narration alone, the
          // edit and a small preview. Private: the media route serves brag.* only.
          const { source, edit, preview, voice } = result.files;
          if (result.source && source && edit && preview) {
            await this.store(sandbox, source, sourceKey(jobId), "video/mp4");
            await this.store(sandbox, edit, `jobs/${jobId}/edit.json`, "application/json");
            await this.store(sandbox, preview, `jobs/${jobId}/preview.mp4`, "video/mp4");
            if (voice) await this.store(sandbox, voice, voiceKey(jobId), "audio/mp4");
            reel = videoReel(jobId, result.source);
          }
        }
        return {
          ok: Boolean(result.ok && videoUrl),
          error: result.ok && videoUrl ? null : (result.error ?? "Render failed"),
          videoUrl,
          posterUrl,
          captionsUrl,
          shareCopy: result.shareCopy,
          plan: result.plan,
          reel,
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

      const { metering, ...outcome } = attempt;

      await step.do("finish job", async () => {
        const db = createDb(this.env.HYPERDRIVE.connectionString);
        const done = { ...(metering ?? {}), finishedAt: new Date() };
        if (outcome.ok) {
          await db.job.update({
            where: { id: jobId },
            data: { ...done, status: "SUCCEEDED", videoUrl: outcome.videoUrl, posterUrl: outcome.posterUrl, captionsUrl: outcome.captionsUrl, shareCopy: outcome.shareCopy, plan: outcome.plan, ...(outcome.reel ? { reel: outcome.reel as object } : {}) },
          });
        } else {
          await db.job.update({ where: { id: jobId }, data: { ...done, status: "FAILED", error: redactSecrets(outcome.error ?? "Render failed").slice(0, 2000) } });
          await grantCredits(db, job.userId, job.creditsCost, `refund:${jobId}`, `refund:${jobId}`, balanceOf(job.paidWith));
        }
      });
    } catch (err) {
      // A step ran out of retries: fail the job and give the credits back.
      await step.do("fail and refund", async () => {
        const db = createDb(this.env.HYPERDRIVE.connectionString);
        await db.job.update({ where: { id: jobId }, data: { status: "FAILED", error: redactSecrets(`Render error: ${String(err)}`).slice(0, 500), finishedAt: new Date() } });
        await grantCredits(db, job.userId, job.creditsCost, `refund:${jobId}`, `refund:${jobId}`, balanceOf(job.paidWith));
      });
    }

    await this.emailCustomer(jobId, step);
    await step.do("destroy sandbox", async () => {
      await sandboxFor(this.env, jobId).destroy();
    });
  }

  /**
   * Tells the customer the job is done (ready, or failed with the credits back) and, when it failed, the owner too.
   * Separate steps, so a retried alert never re-sends the customer's email. An email failure never fails the job.
   */
  private async emailCustomer(jobId: string, step: WorkflowStep) {
    const retry = { retries: { limit: 2, delay: "20 seconds", backoff: "exponential" }, timeout: "1 minute" } as const;
    let status: string | null = null;
    try {
      status = await step.do("email the customer", retry, async () => sendJobEmail(this.env, createDb(this.env.HYPERDRIVE.connectionString), jobId));
    } catch (err) {
      console.error(`job ${jobId}: email not sent: ${redactSecrets(String(err)).slice(0, 300)}`);
    }
    if (status === "SUCCEEDED") return; // unknown (the email step gave up) still alerts: the alert checks the status itself
    try {
      await step.do("alert the owner", retry, async () => sendFailureAlert(this.env, createDb(this.env.HYPERDRIVE.connectionString), jobId));
    } catch (err) {
      console.error(`job ${jobId}: alert not sent: ${redactSecrets(String(err)).slice(0, 300)}`);
    }
  }

  /**
   * A reel: the upload goes from R2 into the container and runner/src/reel.ts edits it, with no agent. The outputs
   * land under a video's names, so the media route and the video page work as they are. The upload is deleted once
   * the reel is delivered; a failed reel keeps it for support until the bucket's uploads/ lifecycle rule clears it.
   */
  private async reel(jobId: string, job: { userId: string; creditsCost: number; watermark: boolean; reel: unknown; paidWith?: string }, step: WorkflowStep) {
    const processId = "render-reel";
    const reel = parseReel(job.reel);
    let finished = false;
    try {
      if (!reel) throw new NonRetryableError("Upload missing: the job has no reel settings");
      await step.do("start reel", { retries: { limit: 3, delay: "20 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
        const sandbox = sandboxFor(this.env, jobId);
        if (await sandbox.getProcess(processId)) return; // a previous attempt of this step already started it
        const upload = await this.env.VIDEOS.get(reel.key);
        if (!upload) throw new NonRetryableError(`Upload missing: ${reel.key}`);
        const input = `input.${reel.key.split(".").pop()}`;
        await sandbox.exec("rm -rf /workspace/out /workspace/work /workspace/result.json /workspace/input.*");
        await sandbox.writeFile(`/workspace/${input}`, upload.body);
        const spec: ReelSpec = {
          jobId,
          input,
          options: reelOptions(reel),
          // The container measures the real length: longer than the credits cover fails, and is refunded.
          maxSeconds: reelSecondsFor(job.creditsCost) + 1,
          watermark: job.watermark,
          watermarkText: `Made with ${this.env.BRAND_NAME}`,
          model: REEL_PLAN_MODEL,
        };
        await sandbox.writeFile("/workspace/reel.json", JSON.stringify(spec));
        await sandbox.exec("chown -R agent:agent /workspace");
        await sandbox.startProcess("runuser -u agent -- node /app/dist/reel.mjs", {
          processId,
          cwd: "/workspace",
          env: {
            HOME: "/home/agent",
            JOB_ROOT: "/workspace",
            // The edit plan and the word timings go to this Worker's virtual hosts; the container holds no keys.
            OPENAI_BASE_URL: `http://${OPENAI_HOST}/v1`,
            OPENAI_API_KEY: "added-by-worker",
            HYPED_TIMINGS_URL: `http://${TIMINGS_HOST}/words`,
            // Stock B-roll searches; the footage downloads from the library's public URLs.
            BROLL_SEARCH_URL: `http://${BROLL_HOST}/search`,
            PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright",
          },
        });
      });

      for (let i = 0; i < reelPolls(reel?.durationSec ?? 0) && !finished; i++) {
        await step.sleep(`wait reel ${i}`, REEL_POLL_EVERY);
        finished = await step.do(`check reel ${i}`, async () => {
          const proc = await sandboxFor(this.env, jobId).getProcess(processId);
          return !proc || !(proc.status === "running" || proc.status === "starting");
        });
      }
      if (!finished) {
        await step.do("stop reel", async () => {
          await sandboxFor(this.env, jobId).killProcess(processId).catch(() => {});
        });
      }

      const attempt = await step.do("collect reel", { retries: { limit: 3, delay: "20 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
        const sandbox = sandboxFor(this.env, jobId);
        const result = await sandbox
          .readFile("/workspace/result.json")
          .then((f) => JSON.parse(f.content) as JobResult)
          .catch(() => null);
        if (!result) return { ok: false, error: finished ? "The reel stopped without a result" : "The reel took too long", media: null, plan: null, metering: null };
        const media =
          result.ok && result.files.video
            ? {
                videoUrl: await this.store(sandbox, result.files.video, `jobs/${jobId}/brag.mp4`, "video/mp4"),
                posterUrl: result.files.poster ? await this.store(sandbox, result.files.poster, `jobs/${jobId}/brag.jpg`, "image/jpeg") : null,
                captionsUrl: result.files.captions ? await this.store(sandbox, result.files.captions, `jobs/${jobId}/captions.srt`, "application/x-subrip") : null,
              }
            : null;
        // For the editor: the reel's decisions and a small clean preview. Private: the media route serves brag.* only.
        if (media && result.files.edit) await this.store(sandbox, result.files.edit, `jobs/${jobId}/edit.json`, "application/json");
        if (media && result.files.preview) await this.store(sandbox, result.files.preview, `jobs/${jobId}/preview.mp4`, "video/mp4");
        return {
          ok: Boolean(media),
          error: media ? null : (result.error ?? "Reel failed"),
          media,
          plan: result.plan,
          metering: {
            model: result.model,
            numTurns: result.numTurns,
            inputTokens: result.usage.input,
            outputTokens: result.usage.output,
            cacheReadTokens: result.usage.cacheRead,
            cacheWriteTokens: result.usage.cacheWrite,
            llmCostUsd: result.llmCostUsd,
            computeSeconds: Math.round(result.durationMs / 1000),
          },
        };
      });

      await step.do("finish job", async () => {
        const db = createDb(this.env.HYPERDRIVE.connectionString);
        const done = { ...(attempt.metering ?? {}), finishedAt: new Date() };
        if (attempt.media) {
          await db.job.update({ where: { id: jobId }, data: { ...done, ...attempt.media, status: "SUCCEEDED", plan: attempt.plan } });
        } else {
          await db.job.update({ where: { id: jobId }, data: { ...done, status: "FAILED", error: redactSecrets(attempt.error ?? "Reel failed").slice(0, 2000) } });
          await grantCredits(db, job.userId, job.creditsCost, `refund:${jobId}`, `refund:${jobId}`, balanceOf(job.paidWith));
        }
      });
      // The upload stays, so the reel can be edited and re-exported for free: the bucket's lifecycle rule for uploads/
      // deletes it after REEL_EDIT_DAYS (7 days).
    } catch (err) {
      // A step ran out of retries: fail the job and give the credits back. The message keeps its customer-facing
      // prefix ("Upload missing: ...") for reelError().
      await step.do("fail and refund", async () => {
        const db = createDb(this.env.HYPERDRIVE.connectionString);
        await db.job.update({ where: { id: jobId }, data: { status: "FAILED", error: redactSecrets(err instanceof Error ? err.message : String(err)).slice(0, 500), finishedAt: new Date() } });
        await grantCredits(db, job.userId, job.creditsCost, `refund:${jobId}`, `refund:${jobId}`, balanceOf(job.paidWith));
      });
    }

    await this.emailCustomer(jobId, step);
    await step.do("destroy sandbox", async () => {
      await sandboxFor(this.env, jobId).destroy();
    });
  }

  /**
   * A re-export of an edited reel or product video: the kept upload (a product video's clean copy, with its narration
   * alone) and the customer's edits (jobs/<id>/edit.json, written by the web app) rendered again, without speech
   * recognition or planning, in a sandbox of its own. It's free, so nothing is charged or refunded; the job stays
   * SUCCEEDED with its current video until the new one replaces it, and only Job.reel.export follows this run. A newer
   * export supersedes an older one still running. A product video keeps its poster and storyboard.
   */
  private async exportReel(jobId: string, revision: number, step: WorkflowStep) {
    const processId = "export-reel";
    const sandboxId = `${jobId}-e${revision}`;
    const setExport = async (patch: Partial<ReelExport>) => {
      const db = createDb(this.env.HYPERDRIVE.connectionString);
      const j = await db.job.findUnique({ where: { id: jobId }, select: { reel: true } });
      const reel = (j?.reel ?? {}) as Record<string, unknown>;
      const current = (reel.export ?? {}) as Partial<ReelExport>;
      if (current.revision !== revision) return; // superseded by a newer export
      await db.job.update({ where: { id: jobId }, data: { reel: { ...reel, export: { ...current, ...patch } } as object } });
    };
    let finished = false;
    try {
      const job = await step.do("load export", async () => {
        const db = createDb(this.env.HYPERDRIVE.connectionString);
        const j = await db.job.findUnique({ where: { id: jobId } });
        const reel = j && (j.kind === "reel" || j.kind === "video") ? parseReel(j.reel) : null;
        if (!j || !reel || (j.kind === "video") !== Boolean(reel.video)) throw new NonRetryableError(`Reel ${jobId} not found`);
        if (reel.export?.revision !== revision) throw new NonRetryableError("Superseded by a newer export");
        return { creditsCost: j.creditsCost, watermark: j.watermark, reel: j.reel };
      });
      const reel = parseReel(job.reel)!;
      const video = reel.video ?? null;

      await step.do("start export", { retries: { limit: 3, delay: "20 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
        const sandbox = sandboxFor(this.env, sandboxId);
        if (await sandbox.getProcess(processId)) return;
        const upload = await this.env.VIDEOS.get(reel.key);
        if (!upload) throw new NonRetryableError(`Upload missing: ${reel.key}`);
        const edit = await this.env.VIDEOS.get(`jobs/${jobId}/edit.json`);
        if (!edit) throw new NonRetryableError("Edit missing: the reel's edits weren't saved");
        const input = `input.${reel.key.split(".").pop()}`;
        await sandbox.exec("rm -rf /workspace/out /workspace/work /workspace/result.json /workspace/input.* /workspace/edit.json /workspace/voice.m4a");
        await sandbox.writeFile(`/workspace/${input}`, upload.body);
        await sandbox.writeFile("/workspace/edit.json", await edit.text());
        // A product video's narration alone, for a new music bed under it.
        const narration = video?.voice ? await this.env.VIDEOS.get(voiceKey(jobId)) : null;
        if (narration) await sandbox.writeFile("/workspace/voice.m4a", narration.body);
        const spec: ReelSpec = {
          jobId,
          input,
          options: reelOptions(reel),
          maxSeconds: video ? VIDEO_MAX_SECONDS : reelSecondsFor(job.creditsCost) + 1,
          // A product video made before captions were added afterwards has the free trial's mark in its picture already.
          watermark: job.watermark && !video?.watermarked,
          watermarkText: `Made with ${this.env.BRAND_NAME}`,
          model: REEL_PLAN_MODEL,
          edit: true,
          ...(video ? { video: { voice: narration ? "voice.m4a" : null } } : {}),
        };
        await sandbox.writeFile("/workspace/reel.json", JSON.stringify(spec));
        await sandbox.exec("chown -R agent:agent /workspace");
        await sandbox.startProcess("runuser -u agent -- node /app/dist/reel.mjs", {
          processId,
          cwd: "/workspace",
          env: { HOME: "/home/agent", JOB_ROOT: "/workspace", OPENAI_BASE_URL: `http://${OPENAI_HOST}/v1`, OPENAI_API_KEY: "added-by-worker", HYPED_TIMINGS_URL: `http://${TIMINGS_HOST}/words`, BROLL_SEARCH_URL: `http://${BROLL_HOST}/search`, PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" },
        });
      });

      for (let i = 0; i < reelPolls(parseReel(job.reel)?.durationSec ?? 0) && !finished; i++) {
        await step.sleep(`wait export ${i}`, REEL_POLL_EVERY);
        finished = await step.do(`check export ${i}`, async () => {
          const proc = await sandboxFor(this.env, sandboxId).getProcess(processId);
          return !proc || !(proc.status === "running" || proc.status === "starting");
        });
      }
      if (!finished) await step.do("stop export", async () => void (await sandboxFor(this.env, sandboxId).killProcess(processId).catch(() => {})));

      const attempt = await step.do("collect export", { retries: { limit: 3, delay: "20 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
        const sandbox = sandboxFor(this.env, sandboxId);
        const result = await sandbox
          .readFile("/workspace/result.json")
          .then((f) => JSON.parse(f.content) as JobResult)
          .catch(() => null);
        if (!result?.ok || !result.files.video) return { media: null, plan: null, error: result?.error ?? (finished ? "The export stopped without a result" : "The export took too long") };
        // Same names, so the share page and every link show the new version; ?v= gets past browser caches.
        const v = `?v=${revision}`;
        // A product video keeps the poster its agent chose (the runner makes none), and its SRT when it has no words.
        const media: { videoUrl: string; posterUrl?: string | null; captionsUrl?: string | null } = {
          videoUrl: (await this.store(sandbox, result.files.video, `jobs/${jobId}/brag.mp4`, "video/mp4")) + v,
        };
        if (result.files.poster || !video) media.posterUrl = result.files.poster ? (await this.store(sandbox, result.files.poster, `jobs/${jobId}/brag.jpg`, "image/jpeg")) + v : null;
        if (result.files.captions || !video) media.captionsUrl = result.files.captions ? (await this.store(sandbox, result.files.captions, `jobs/${jobId}/captions.srt`, "application/x-subrip")) + v : null;
        if (result.files.edit) await this.store(sandbox, result.files.edit, `jobs/${jobId}/edit.json`, "application/json");
        // A product video's storyboard stays its agent's.
        return { media, plan: video ? undefined : result.plan, error: null };
      });

      await step.do("finish export", async () => {
        if (attempt.media) {
          const db = createDb(this.env.HYPERDRIVE.connectionString);
          await db.job.update({ where: { id: jobId }, data: { ...attempt.media, ...(attempt.plan !== undefined ? { plan: attempt.plan } : {}) } });
          await setExport({ status: "done", finishedAt: new Date().toISOString() });
        } else {
          await setExport({ status: "failed", finishedAt: new Date().toISOString(), error: redactSecrets(attempt.error ?? "Export failed").slice(0, 500) });
        }
      });
    } catch (err) {
      await step.do("fail export", async () => {
        await setExport({ status: "failed", finishedAt: new Date().toISOString(), error: redactSecrets(err instanceof Error ? err.message : String(err)).slice(0, 500) });
      });
    }
    await step.do("destroy export sandbox", async () => {
      await sandboxFor(this.env, sandboxId).destroy();
    });
  }

  /**
   * Makes an older product video editable (one made before the captions were added after the agent): its video as the
   * clean copy, with the narration alone and its words from the job's kept workspace, and the edit and small preview
   * reel.ts writes for the editor. Its captions and the free trial's mark are in its picture already. Free; the video
   * itself doesn't change. Job.reel.export (revision 0) follows this run, which the web app started.
   */
  private async prepareVideo(jobId: string, step: WorkflowStep) {
    const processId = "prepare-video";
    const sandboxId = `${jobId}-prep`;
    const setPrepared = async (patch: Partial<ReelExport>, reel?: ReelJob) => {
      const db = createDb(this.env.HYPERDRIVE.connectionString);
      const j = await db.job.findUnique({ where: { id: jobId }, select: { reel: true } });
      const current = ((j?.reel ?? {}) as { export?: Partial<ReelExport> }).export ?? {};
      if (current.revision !== 0) return; // exported since, or never started here
      const next = reel ?? ((j?.reel ?? {}) as ReelJob);
      await db.job.update({ where: { id: jobId }, data: { reel: { ...next, export: { ...current, ...patch } } as object } });
    };
    let finished = false;
    try {
      const job = await step.do("load video", async () => {
        const db = createDb(this.env.HYPERDRIVE.connectionString);
        const j = await db.job.findUnique({ where: { id: jobId } });
        if (!j || j.kind !== "video" || j.status !== "SUCCEEDED") throw new NonRetryableError(`Video ${jobId} not found`);
        return { watermark: j.watermark, captions: j.captions, voice: j.voice };
      });

      await step.do("start prepare", { retries: { limit: 3, delay: "20 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
        const sandbox = sandboxFor(this.env, sandboxId);
        if (await sandbox.getProcess(processId)) return;
        const made = await this.env.VIDEOS.get(`jobs/${jobId}/brag.mp4`);
        if (!made) throw new NonRetryableError("Upload missing: the video's file is gone");
        await sandbox.exec("rm -rf /workspace/out /workspace/work /workspace/result.json /workspace/input.mp4 /workspace/ws /workspace/workspace.tgz /workspace/voice.wav /workspace/captions.json");
        await sandbox.writeFile("/workspace/input.mp4", made.body);
        // The narration and its words, from the workspace the job kept for revisions (videos without one have neither).
        const workspace = job.voice ? await this.env.VIDEOS.get(`jobs/${jobId}/workspace.tgz`) : null;
        let narrated = false;
        if (workspace) {
          await sandbox.writeFile("/workspace/workspace.tgz", workspace.body);
          await sandbox.exec("mkdir -p /workspace/ws && tar -xzf /workspace/workspace.tgz -C /workspace/ws brag-output/work/voice/voice.wav brag-output/work/voice/captions.json; true");
          const found = await sandbox.exec("test -f /workspace/ws/brag-output/work/voice/voice.wav && test -f /workspace/ws/brag-output/work/voice/captions.json && mv /workspace/ws/brag-output/work/voice/voice.wav /workspace/ws/brag-output/work/voice/captions.json /workspace/");
          narrated = found.exitCode === 0;
          await sandbox.exec("rm -rf /workspace/ws /workspace/workspace.tgz");
        }
        const spec: ReelSpec = {
          jobId,
          input: "input.mp4",
          // As made: its captions (drawn into its picture already, when it had them) aren't added again.
          options: videoOptions(false),
          maxSeconds: VIDEO_MAX_SECONDS,
          watermark: false,
          watermarkText: `Made with ${this.env.BRAND_NAME}`,
          model: REEL_PLAN_MODEL,
          video: { voice: narrated ? "voice.wav" : null, words: narrated ? "captions.json" : null, editorOnly: true },
        };
        await sandbox.writeFile("/workspace/reel.json", JSON.stringify(spec));
        await sandbox.exec("chown -R agent:agent /workspace");
        await sandbox.startProcess("runuser -u agent -- node /app/dist/reel.mjs", { processId, cwd: "/workspace", env: { HOME: "/home/agent", JOB_ROOT: "/workspace", PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" } });
      });

      for (let i = 0; i < REEL_MAX_POLLS && !finished; i++) {
        await step.sleep(`wait prepare ${i}`, REEL_POLL_EVERY);
        finished = await step.do(`check prepare ${i}`, async () => {
          const proc = await sandboxFor(this.env, sandboxId).getProcess(processId);
          return !proc || !(proc.status === "running" || proc.status === "starting");
        });
      }
      if (!finished) await step.do("stop prepare", async () => void (await sandboxFor(this.env, sandboxId).killProcess(processId).catch(() => {})));

      const outcome = await step.do("collect prepare", { retries: { limit: 3, delay: "20 seconds", backoff: "exponential" }, timeout: "10 minutes" }, async () => {
        const sandbox = sandboxFor(this.env, sandboxId);
        const result = await sandbox
          .readFile("/workspace/result.json")
          .then((f) => JSON.parse(f.content) as JobResult)
          .catch(() => null);
        if (!result?.ok || !result.files.edit || !result.files.preview) return { reel: null, error: result?.error ?? (finished ? "Preparing stopped without a result" : "Preparing took too long") };
        await this.store(sandbox, result.files.edit, `jobs/${jobId}/edit.json`, "application/json");
        await this.store(sandbox, result.files.preview, `jobs/${jobId}/preview.mp4`, "video/mp4");
        if (result.files.voice) await this.store(sandbox, result.files.voice, voiceKey(jobId), "audio/mp4");
        // The video as it is becomes the clean copy, copied inside the bucket.
        const made = await this.env.VIDEOS.get(`jobs/${jobId}/brag.mp4`);
        if (!made) return { reel: null, error: "Upload missing: the video's file is gone" };
        await this.env.VIDEOS.put(sourceKey(jobId), made.body.pipeThrough(new FixedLengthStream(made.size)), { httpMetadata: { contentType: "video/mp4" } });
        const edit = JSON.parse((await sandbox.readFile(`/workspace/${result.files.edit}`)).content) as { width: number; height: number; duration: number; words: unknown[] };
        const narrated = Boolean(result.files.voice);
        // Narrated videos had their captions drawn in by the agent, unless the customer turned them off.
        const burned = Boolean(job.voice) && job.captions !== false;
        const source = { burned, watermarked: job.watermark, narrated: Boolean(job.voice), voice: narrated, captions: false, accent: null, width: edit.width, height: edit.height, duration: edit.duration, bytes: made.size };
        return { reel: videoReel(jobId, source), error: null };
      });

      if (outcome.reel) await step.do("finish prepare", async () => setPrepared({ status: "done", finishedAt: new Date().toISOString() }, outcome.reel!));
      else await step.do("fail prepare", async () => setPrepared({ status: "failed", finishedAt: new Date().toISOString(), error: redactSecrets(outcome.error ?? "Preparing failed").slice(0, 500) }));
    } catch (err) {
      await step.do("fail prepare", async () => setPrepared({ status: "failed", finishedAt: new Date().toISOString(), error: redactSecrets(err instanceof Error ? err.message : String(err)).slice(0, 500) }));
    }
    await step.do("destroy prepare sandbox", async () => {
      await sandboxFor(this.env, sandboxId).destroy();
    });
  }

  /**
   * Downloads a private repo with the customer's saved GitHub token: its default branch, or for a pull request,
   * release or comparison the change's head, with what GitHub says about the change (its facts and diff, for the
   * runner's .hyped/change.json). The token is decrypted here, used only for requests to GitHub and dropped: it never
   * reaches the container, a workflow step result or a log.
   */
  private async downloadPrivateRepo(userId: string, repoUrl: string): Promise<{ archive: ReadableStream<Uint8Array>; change: { json: string; diff: string } | null }> {
    const db = createDb(this.env.HYPERDRIVE.connectionString);
    const saved = await db.repoToken.findUnique({ where: { userId } });
    if (!saved) throw new NonRetryableError("Private repository: no GitHub token is saved (paste one under the repo link)");
    let token: string;
    try {
      const sealed = parseSealedToken(JSON.parse(saved.sealed));
      if (!sealed || !this.env.REPO_TOKEN_PRIVATE_KEY) throw new Error("unreadable");
      token = await openToken(sealed, userId, JSON.parse(this.env.REPO_TOKEN_PRIVATE_KEY) as RepoTokenJwk);
    } catch {
      throw new NonRetryableError("Private repository: the saved GitHub token can't be read. Paste it again under the repo link.");
    }
    const source = parseGithubSource(repoUrl);
    const [, owner, name] = new URL(repoUrl).pathname.split("/");
    const repo = source?.slug ?? `${owner}/${(name ?? "").replace(/\.git$/, "")}`;
    // Only ever api.github.com: the paths come from the parsed link.
    const github = (path: string, accept = "application/vnd.github+json") =>
      fetch(`https://api.github.com${path}`, { headers: { authorization: `Bearer ${token}`, accept, "x-github-api-version": "2022-11-28", "user-agent": "hyped-render" } });
    let change: { json: string; diff: string } | null = null;
    let ref = "";
    if (source?.change) {
      try {
        const read = await fetchChangeFacts(source, repoUrl, github);
        change = changeFiles(read.facts, read.diff);
        ref = `/${read.head}`;
      } catch (err) {
        if (err instanceof GithubApiError && [401, 403, 404, 422].includes(err.status)) {
          const access = source.change.kind === "pull" ? "Contents and Pull requests: read-only" : "Contents: read-only";
          throw new NonRetryableError(`Private repository: GitHub answered ${err.status} for ${err.what}. Check that your saved token can read it (${access}).`);
        }
        throw err;
      }
    }
    // GitHub answers with a redirect to a short-lived download link, which fetch follows without the token.
    const res = await github(`/repos/${repo}/tarball${ref}`);
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new NonRetryableError(`Private repository: GitHub answered ${res.status}. Check that your saved token can read ${repo}.`);
    }
    if (!res.ok || !res.body) throw new Error(`Private repository: GitHub download failed (${res.status})`);
    await db.repoToken.update({ where: { userId }, data: { lastUsedAt: new Date() } });
    return { archive: res.body.pipeThrough(limitBytes(MAX_REPO_BYTES)), change };
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

/**
 * Serves finished videos, posters and captions from R2 (with byte ranges, so players can seek), and nothing else:
 * the bucket also holds each job's workspace, which can contain a customer's private repo, so it is never public.
 * Production: media.hyped.video/jobs/…; workers.dev and local development: /media/jobs/….
 */
async function serveMedia(request: Request, env: Env, key: string): Promise<Response> {
  if (!/^jobs\/[a-z0-9]+\/(brag\.mp4|brag\.jpg|captions\.srt)$/.test(key)) return new Response("Not found", { status: 404 });
  return serveFile(request, env, key);
}

/** A file from the bucket, with conditional requests and ranges (so players can seek). */
async function serveFile(request: Request, env: Env, key: string): Promise<Response> {
  let object;
  try {
    object = await env.VIDEOS.get(key, { range: request.headers, onlyIf: request.headers });
  } catch (err) {
    // A failing bucket (a missing binding, a deleted or renamed bucket, R2 itself) would otherwise surface as a bare
    // Cloudflare 1101 on every video: log what R2 said, so Workers Logs shows the cause, and answer with a retryable 503.
    console.error(`[media] R2 get failed for ${key}:`, err instanceof Error ? `${err.name}: ${err.message}` : err);
    return new Response("Media is temporarily unavailable", { status: 503, headers: { "retry-after": "60", "cache-control": "no-store" } });
  }
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=3600");
  if (!("body" in object)) return new Response(null, { status: 304, headers }); // conditional request matched
  const range = object.range as { offset?: number; length?: number } | undefined;
  if (range && request.headers.has("range")) {
    const start = range.offset ?? 0;
    const end = start + (range.length ?? object.size - start) - 1;
    headers.set("content-range", `bytes ${start}-${end}/${object.size}`);
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { headers });
}

const UPLOAD_KEY = new RegExp(`^uploads/[\\w-]+/[\\w-]+\\.(${Object.values(REEL_UPLOAD_TYPES).join("|")})$`);

/**
 * Local development only: `next dev` has a local R2 of its own, so the web app sends reel uploads here, into the
 * bucket this Worker's workflow reads (web/lib/reel-uploads.ts). Off unless DEV_START_TOKEN is set, like /dev/start.
 */
async function devUploads(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.DEV_START_TOKEN || request.headers.get("x-dev-start-token") !== env.DEV_START_TOKEN) return new Response("Not found", { status: 404 });
  const op = url.pathname.slice("/dev/uploads/".length);
  const body = request.method === "POST" ? ((await request.json().catch(() => ({}))) as { key?: string; uploadId?: string; contentType?: string; parts?: R2UploadedPart[] }) : {};
  const key = body.key ?? url.searchParams.get("key") ?? "";
  const uploadId = body.uploadId ?? url.searchParams.get("uploadId") ?? "";
  if (!UPLOAD_KEY.test(key)) return new Response("Bad key", { status: 400 });
  if (op === "create") return Response.json({ uploadId: (await env.VIDEOS.createMultipartUpload(key, { httpMetadata: { contentType: body.contentType } })).uploadId });
  if (op === "part") {
    const part = await env.VIDEOS.resumeMultipartUpload(key, uploadId).uploadPart(Number(url.searchParams.get("part")), await request.arrayBuffer());
    return Response.json({ partNumber: part.partNumber, etag: part.etag });
  }
  if (op === "complete") return Response.json({ size: (await env.VIDEOS.resumeMultipartUpload(key, uploadId).complete(body.parts ?? [])).size });
  if (op === "abort") {
    await env.VIDEOS.resumeMultipartUpload(key, uploadId).abort();
    return Response.json({ ok: true });
  }
  if (op === "head") {
    // The first bytes too, so the web app can check the file really is a video.
    const object = await env.VIDEOS.get(key, { range: { offset: 0, length: 16 } });
    if (!object) return new Response("Not found", { status: 404 });
    const start = [...new Uint8Array(await object.arrayBuffer())].map((b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({ size: object.size, contentType: object.httpMetadata?.contentType ?? null, start });
  }
  if (op === "delete") {
    await env.VIDEOS.delete(key);
    return Response.json({ ok: true });
  }
  return new Response("Not found", { status: 404 });
}

const EDITOR_FILE = /^jobs\/[a-z0-9]+\/(edit\.json|preview\.mp4|voice\.m4a|source\.mp4)$/;

/**
 * Local development only: the reel editor's files (web/lib/reel-edits.ts) in this Worker's bucket, read (with ranges,
 * for the preview player) and written by the web app's `next dev`. Off unless DEV_START_TOKEN is set, like /dev/start.
 */
async function devFiles(request: Request, env: Env, key: string): Promise<Response> {
  if (!env.DEV_START_TOKEN || request.headers.get("x-dev-start-token") !== env.DEV_START_TOKEN) return new Response("Not found", { status: 404 });
  if (!EDITOR_FILE.test(key)) return new Response("Bad key", { status: 400 });
  if (request.method === "PUT") {
    await env.VIDEOS.put(key, await request.arrayBuffer(), { httpMetadata: { contentType: request.headers.get("content-type") ?? "application/octet-stream" } });
    return Response.json({ ok: true });
  }
  return serveFile(request, env, key);
}

/** What a chat edit sends: the reel as the LLM reads it (chatContext) and the customer's message. */
type ReelChatInput = { context: string; message: string; history?: unknown; frames?: unknown };
/** What comes back, unchecked: the web app checks the changes against the reel (parseChatOps) before using them. */
type ReelChatResult = { reply: string; ops: unknown[]; inputTokens: number; outputTokens: number };

/** One chat edit: the reel and the message to the plan's small model, with this Worker's key (the web app has none). */
async function reelChat(env: Env, input: ReelChatInput): Promise<ReelChatResult> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set on the render Worker");
  const context = String(input.context ?? "").slice(0, 60_000);
  const message = String(input.message ?? "").slice(0, 1000);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: REEL_PLAN_MODEL,
      reasoning_effort: "low",
      messages: chatMessages(context, message, input.history, input.frames),
      response_format: { type: "json_schema", json_schema: { name: "reel_chat", strict: true, schema: CHAT_SCHEMA } },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`The assistant failed (${res.status}): ${redactSecrets((await res.text()).slice(0, 200))}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as { reply?: unknown; ops?: unknown };
  return { reply: String(parsed.reply ?? "").slice(0, 600), ops: Array.isArray(parsed.ops) ? parsed.ops : [], inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 };
}

/** Ask AI's answer in a new project, before it has a clip (packages/core/src/project-chat.ts), with the tokens it took. */
type ProjectChatResult = ProjectAnswer & { inputTokens: number; outputTokens: number };

/** Ask AI in a new project with no clip yet: the conversation to the plan's small model, as reelChat, with this Worker's key. */
async function projectChat(env: Env, input: unknown): Promise<ProjectChatResult> {
  if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set on the render Worker");
  const clean = cleanProjectChat(input);
  if (!clean) throw new Error("No message to answer");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(projectChatRequest(clean)),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`The assistant failed (${res.status}): ${redactSecrets((await res.text()).slice(0, 200))}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const answer = parseProjectAnswer(body.choices?.[0]?.message?.content ?? "");
  if (!answer) throw new Error("The assistant's answer couldn't be read");
  return { ...answer, inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 };
}

/** Stock footage for a search: clips, or why there are none (`status`: 503 not set up, 429 the library's rate limit, 502 it failed). */
export type BrollSearch = { clips: BrollClip[]; error?: string; status?: 429 | 502 | 503 };

// Searches are kept a day: Pixabay asks for it, and it spares both libraries' rate limits. In the bucket under
// cache/, which serveMedia never serves.
const BROLL_CACHE_MS = 24 * 3600 * 1000;

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Stock footage for a search, as clips for the reel's orientation (at least 3 seconds long, the best fits first), from
 * the library this Worker has a key for: Pexels first (it searches by orientation), else Pixabay. The editor and the
 * runner both search here, so the keys stay in this Worker.
 */
async function searchBroll(env: Env, input: { query: string; portrait: boolean }): Promise<BrollSearch> {
  const source: BrollSource | null = env.PEXELS_API_KEY ? "pexels" : env.PIXABAY_API_KEY ? "pixabay" : null;
  if (!source) return { clips: [], error: "Stock B-roll isn't set up yet.", status: 503 };
  const query = String(input.query ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 80);
  if (!query) return { clips: [] };
  const cacheKey = `cache/broll/${source}/${input.portrait ? "portrait" : "landscape"}/${await sha256(query)}.json`;
  const cached = await env.VIDEOS.get(cacheKey).catch(() => null);
  if (cached && Date.now() - cached.uploaded.getTime() < BROLL_CACHE_MS) {
    const clips = ((await cached.json().catch(() => [])) as unknown[]).map((c) => parseClip(c)).filter((c): c is BrollClip => c !== null);
    return { clips };
  }
  const url = stockSearchUrl(source, query, input.portrait);
  const res = await fetch(source === "pixabay" ? `${url}&key=${encodeURIComponent(env.PIXABAY_API_KEY ?? "")}` : url, {
    headers: source === "pexels" ? { authorization: env.PEXELS_API_KEY ?? "" } : {},
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (res?.status === 429) return { clips: [], error: "Stock search is busy right now. Try again in a few minutes.", status: 429 };
  if (!res?.ok) return { clips: [], error: `${BROLL_SOURCES[source].label} didn't answer (${res?.status ?? "no answer"})`, status: 502 };
  const clips = stockClips(source, await res.json().catch(() => null), input.portrait);
  await env.VIDEOS.put(cacheKey, JSON.stringify(clips), { httpMetadata: { contentType: "application/json" } }).catch(() => {});
  return { clips };
}

/**
 * The reel editor's assistant for the web app (its REEL_ASSISTANT service binding to this entrypoint): chat edits, Ask AI
 * in a new project before its clip, and stock B-roll searches. RPC only: no URL reaches it, so only the web Worker can
 * ask, after it has checked who's asking.
 */
export class ReelAssistant extends WorkerEntrypoint<Env> {
  async chat(input: ReelChatInput): Promise<ReelChatResult> {
    return reelChat(this.env, input);
  }
  async projectChat(input: unknown): Promise<ProjectChatResult> {
    return projectChat(this.env, input);
  }
  async searchBroll(input: { query: string; portrait: boolean }): Promise<BrollSearch> {
    return searchBroll(this.env, input);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Local development only, like /dev/start: the web app's `next dev` asks for B-roll searches and chat edits here
    // (Ask AI before a clip too).
    if (request.method === "POST" && url.pathname === "/dev/broll-search") {
      if (!env.DEV_START_TOKEN || request.headers.get("x-dev-start-token") !== env.DEV_START_TOKEN) return new Response("Not found", { status: 404 });
      return Response.json(await searchBroll(env, (await request.json()) as { query: string; portrait: boolean }));
    }
    if (request.method === "POST" && url.pathname === "/dev/reel-chat") {
      if (!env.DEV_START_TOKEN || request.headers.get("x-dev-start-token") !== env.DEV_START_TOKEN) return new Response("Not found", { status: 404 });
      try {
        return Response.json(await reelChat(env, (await request.json()) as ReelChatInput));
      } catch (err) {
        return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
      }
    }
    if (request.method === "POST" && url.pathname === "/dev/project-chat") {
      if (!env.DEV_START_TOKEN || request.headers.get("x-dev-start-token") !== env.DEV_START_TOKEN) return new Response("Not found", { status: 404 });
      try {
        return Response.json(await projectChat(env, await request.json()));
      } catch (err) {
        return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
      }
    }
    if (url.pathname.startsWith("/dev/files/")) return devFiles(request, env, decodeURIComponent(url.pathname.slice("/dev/files/".length)));
    if (request.method === "GET" && url.pathname.startsWith("/media/")) return serveMedia(request, env, decodeURIComponent(url.pathname.slice(7)));
    if (request.method === "GET" && url.pathname.startsWith("/jobs/")) return serveMedia(request, env, decodeURIComponent(url.pathname.slice(1)));
    if (url.pathname.startsWith("/dev/uploads/")) return devUploads(request, env, url);
    // Local development only: the web app's `next dev` can't use the Workflow binding across Workers, so it asks
    // here. Off unless DEV_START_TOKEN is set, which only happens in render/.dev.vars; production never has it.
    if (request.method === "POST" && url.pathname === "/dev/start") {
      if (!env.DEV_START_TOKEN || request.headers.get("x-dev-start-token") !== env.DEV_START_TOKEN) return new Response("Not found", { status: 404 });
      const { jobId, export: revision, prepare } = (await request.json().catch(() => ({}))) as { jobId?: string; export?: number; prepare?: boolean };
      if (!jobId || !/^[a-z0-9]+$/.test(jobId)) return new Response("Bad job id", { status: 400 });
      if (revision !== undefined && !(Number.isInteger(revision) && revision > 0)) return new Response("Bad revision", { status: 400 });
      const instance = prepare ? { id: `${jobId}-prep-${Date.now()}`, params: { jobId, prepare: true } } : revision ? { id: `${jobId}-e${revision}`, params: { jobId, export: revision } } : { id: jobId, params: { jobId } };
      await env.VIDEO_JOBS.create(instance);
      return Response.json({ ok: true });
    }
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
      await grantCredits(db, job.userId, job.creditsCost, `refund:${job.id}`, `refund:${job.id}`, balanceOf(job.paidWith));
      await sandboxFor(env, job.id).destroy().catch(() => {});
      await sendJobEmail(env, db, job.id).catch((err) => console.error(`job ${job.id}: email not sent: ${redactSecrets(String(err)).slice(0, 300)}`));
      await sendFailureAlert(env, db, job.id).catch((err) => console.error(`job ${job.id}: alert not sent: ${redactSecrets(String(err)).slice(0, 300)}`));
    }
  },
} satisfies ExportedHandler<Env>;
