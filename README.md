# LaunchReel: brag as a service

A paid web app built on [latent-spaces/brag](https://github.com/latent-spaces/brag) (MIT), running on Cloudflare.

1. A customer pastes a website or a GitHub repo (public, or private with a saved token).
2. They get a launch video: a 15–30 second teaser for social, or a 60–90 second launch video for their homepage. MP4, poster image and share copy.
3. They can ask for revisions in plain English.

About the name: "LaunchReel" is a placeholder, and other products already use it, so rename before launch (see [docs/PLAN.md](docs/PLAN.md)). Don't sell under the "brag" name either: the code is MIT-licensed, but the name belongs to the upstream project. The name lives in `web/lib/brand.ts` and `render/wrangler.jsonc` (`BRAND_NAME`).

Docs:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how it works, with diagrams
- [docs/PLAN.md](docs/PLAN.md): launch plan, pricing, go-to-market
- [docs/UNIT_ECONOMICS.md](docs/UNIT_ECONOMICS.md): cost per video and margins
- [docs/STRATEGY.md](docs/STRATEGY.md): market research

## How it's built

```
Browser ──> web Worker (Next.js via OpenNext)          render Worker
             │  Clerk auth, Dodo Payments                 │  Workflow per video (durable, retried)
             │  POST /api/jobs → spend credits ───────────┼─> starts a Sandbox container:
             │    → start workflow (binding)              │    Claude Agent SDK or Codex CLI + brag-slim,
             ▼                                            │    Chromium, FFmpeg (runner/)
   Neon Postgres via Hyperdrive <─────────────────────────┤  model calls → virtual host → Worker adds the key
     jobs, credit ledger, metering                        │  outputs → R2 (bindings, no keys in the container)
                                                          ▼
                                                    R2: brag.mp4, brag.jpg, workspace.tgz
```

| Folder | What it is | Runs on |
|---|---|---|
| `web/` | Landing page, dashboard (Vercel-style UI), API routes, Dodo checkout/portal/webhook | Cloudflare Workers via OpenNext |
| `render/` | `VideoJobWorkflow` (the render pipeline), `VideoSandbox` (per-job container + key injection), a cron safety net | Cloudflare Workers + Workflows + Containers |
| `runner/` | Code inside each container: runs brag-slim with the Claude Agent SDK or the Codex CLI (OpenAI). Also `npm run measure`, the local cost benchmark | The Sandbox container / your laptop |
| `packages/core/` | Prisma schema, pricing, credit ledger, and the Worker↔container job contract | Shared |

Why agent harnesses: brag is an *agent skill*, not a library. Each video is an agent session that reads the product, writes a storyboard, writes the animation code, renders it in headless Chromium, checks stills and fixes them. The Claude Agent SDK (the Claude Code harness as a library) and the Codex CLI both load skills from files, so brag-slim runs unmodified on either.

## Claude or OpenAI

Every video runs on one of two engines. Choose them with vars in `render/wrangler.jsonc`:

| Var | Default | What it does |
|---|---|---|
| `ENGINE` | `openai` (for now) | The primary engine: `claude` (Claude Agent SDK) or `openai` (Codex CLI) |
| `ENGINE_FALLBACK` | `claude` (for now) | Runs the job once more when the primary fails because of its provider (bad key, rate limit, outage). `""` turns it off |
| `CLAUDE_MODEL_PAID` / `CLAUDE_MODEL_FREE` | `claude-opus-5-5` / `claude-sonnet-5` | Claude models for paid and free videos |
| `OPENAI_MODEL_PAID` / `OPENAI_MODEL_FREE` | `gpt-6-sol` / `gpt-6-sol` | OpenAI models for paid and free videos |

- It runs OpenAI first for now, until a working Anthropic key is in place. Then switch back to `ENGINE` `claude` and `ENGINE_FALLBACK` `openai` (and `ENGINE=claude` in `.env` for `npm run measure`).
- An engine without an API key is skipped, so you can run on one provider only.
- Failover is quick. When another engine is waiting, Claude gets 6 retries (about 40 seconds) before giving up on a provider error, instead of its default of about 3 minutes. The last engine keeps its full retry budget.
- `npm run keys` tells you whether each key works: valid, has credit, and can use the model.
- Only provider failures get a second attempt. If the agent gives up, hits a limit or runs out of time, the job is refunded without a retry, so a failed job never costs more than one run.
- `gpt-6-sol` has the same list prices as Sonnet 5. `gpt-6-astra` is closer to Opus but costs 2.5× as much. Codex also has no per-video dollar ceiling (the Claude SDK does), so measure before switching to it.

## Private repositories

Customers can make videos from private GitHub repos. They save a read-only, fine-grained GitHub token once, in **Settings → Private repositories**.

How the token is protected:
1. **Encrypted in the customer's browser.** The browser encrypts it to the render Worker's public key (ECDH P-256 + AES-256-GCM) before anything is sent. The web Worker and the database only ever get ciphertext. `packages/core/src/repo-token.ts` holds the scheme.
2. **Only the render Worker can decrypt it.** Its private key is a Cloudflare secret (`REPO_TOKEN_PRIVATE_KEY`). Cloudflare secrets can't be read back from the dashboard or the API.
3. **Decrypted only to download.** The render Worker decrypts the token for a single request to GitHub, streams the repo into the container as files, and drops the token. It never enters the container, a workflow step result or a log.
4. **Bound to the customer.** The ciphertext is tied to the customer's user id. Copied to another account in the database, it won't decrypt.
5. **Least privilege.** Customers are asked for a fine-grained token with *Contents: read-only* on selected repos and an expiry. They can remove it in Settings or revoke it on GitHub at any time.

What this doesn't protect against: someone who can deploy code to your Workers could change it to capture tokens. No web app can rule that out. So deploy only through reviewed CI, keep Cloudflare access to a few people, and move to a GitHub App with short-lived tokens when you build the GitHub integration (PLAN Step 8).

Keys:
```bash
npm run repo-keys -- --local        # dev keys for local testing: .env + render/.dev.vars
npm run repo-keys -- --production   # private key straight into the render Worker's secrets; public key into web/wrangler.jsonc
```
Production gets its own key, which never exists in a file. A new key makes saved tokens unreadable, and customers add them again.

## See the UI in 10 seconds (demo mode)

```bash
npm install
npm run demo        # http://localhost:3100
```

- Demo mode renders the whole dashboard with sample data. It needs no database, Clerk or Dodo keys.
- It's read-only: creating videos and checkout are disabled.
- It only works in development (`next dev`) and can never switch on in a production build.

## Run locally (real data)

```bash
git clone https://github.com/latent-spaces/brag ../brag-src   # the upstream skills
npm install
npm run sync-skill              # optional: refreshes the vendored brag-slim skill (and the full /brag) from upstream
cp .env.example .env            # fill in Clerk, Dodo (test mode) and optionally the model keys
npm run keys                    # checks the model keys work and copies them into render/.dev.vars
docker compose up -d            # local Postgres
npm run db:push
npm run dev:web                 # http://localhost:3000, with Cloudflare bindings emulated from web/wrangler.jsonc
npm run dev:render              # render Worker on wrangler dev (needs Docker for the container)
```

**Before setting prices, measure real cost:** `npm run measure` runs brag-slim directly on your machine (no Cloudflare needed) on the 5 upstream example sites. It writes tokens and dollars per video to `measurements/run-*.csv`.
- Compare models with `CLAUDE_MODEL=claude-sonnet-5 npm run measure`.
- Measure the OpenAI engine with `ENGINE=openai npm run measure` (model from `OPENAI_MODEL`, default `gpt-6-sol`).
- See [docs/UNIT_ECONOMICS.md](docs/UNIT_ECONOMICS.md) for how to read the results.

## Deploy to Cloudflare

You need a Cloudflare account on the Workers Paid plan (Containers require it) and Docker, because Wrangler builds the container image.

> **Deploy from CI, not from your laptop.** The OpenNext build compiles local `.env` files into the uploaded web Worker, so a laptop deploy would ship whatever secrets are in your `.env`. Use Cloudflare Workers Builds or GitHub Actions:
> - web: root directory `web`, build `npx opennextjs-cloudflare build`, deploy `npx opennextjs-cloudflare deploy`
> - render: `npm run deploy:render` from the repo root
>
> Put `NEXT_PUBLIC_*` values in the build variables and everything else in Worker secrets.

1. **Database:** create a Neon Postgres database. Use its *non-pooled* connection string; Hyperdrive does the pooling. Then:
   ```bash
   DATABASE_URL="<neon url>" npm run db:push
   npx wrangler hyperdrive create launchreel-db --connection-string="<neon url>" --caching-disabled
   ```
   - `--caching-disabled` matters. Hyperdrive otherwise caches reads for up to 60 seconds and doesn't clear the cache on writes, so credit balances and video status would go stale.
   - Paste the Hyperdrive ID into `web/wrangler.jsonc` and `render/wrangler.jsonc`.
2. **Storage:** create the bucket:
   ```bash
   npx wrangler r2 bucket create launchreel-videos
   ```
   Then give it a public custom domain and set `PUBLIC_VIDEO_BASE_URL` in `render/wrangler.jsonc`.
3. **Render Worker:** set the model keys. Set both to get the automatic fallback, or one to run on that provider only.
   ```bash
   cd render
   npx wrangler secret put ANTHROPIC_API_KEY
   npx wrangler secret put OPENAI_API_KEY
   ```
   Then create the key pair for private-repo tokens. The private key goes straight into Cloudflare and is never shown:
   ```bash
   cd .. && npm run repo-keys -- --production
   ```
   Then, from the repo root:
   ```bash
   npm run deploy:render
   ```
   This bundles the runner, builds the container image (with the vendored brag-slim skill) and deploys the Worker.
4. **Web Worker:** put the secrets:
   ```bash
   cd web
   npx wrangler secret put CLERK_SECRET_KEY
   npx wrangler secret put DODO_PAYMENTS_API_KEY
   npx wrangler secret put DODO_PAYMENTS_WEBHOOK_KEY
   npx wrangler secret put ADMIN_USER_IDS
   ```
   Then set the `DODO_PRODUCT_*` and `DODO_PAYMENTS_ENVIRONMENT` vars, and deploy from the repo root:
   ```bash
   npm run deploy:web
   ```
   Deploy the render Worker first: the web Worker binds to its workflow.

Payments run on [Dodo Payments](https://dodopayments.com), which acts as merchant of record. It collects and remits sales tax and VAT worldwide.
- **Test mode first.** Build everything in test mode. Dodo reviews AI content-generation tools, so start business verification in week 1 (see [docs/PLAN.md](docs/PLAN.md)).
- **Products.** Create 3 monthly subscriptions (Starter, Pro, Agency) and 1 one-time product (a single video).
- **Webhook.** Point it at `https://<your-app>/api/dodo/webhook` and put its secret in `DODO_PAYMENTS_WEBHOOK_KEY`. Subscribe it to:
  - `payment.succeeded`
  - `subscription.active`, `subscription.renewed`, `subscription.plan_changed`, `subscription.cancelled`, `subscription.expired`, `subscription.failed`
  - `refund.succeeded`, `dispute.opened`, `dispute.won`
- **How purchases become credits.** Every grant is idempotent, so duplicate webhook deliveries are safe.
  - One-time purchases grant credits on `payment.succeeded`.
  - Each paid subscription period grants its credits once.
  - Upgrades top up the difference.
  - Refunds and disputes take back unspent credits.

## Security

The agent runs shell commands with `bypassPermissions` on **untrusted input**: customer repos and websites can contain prompt injection. So the render container holds nothing worth stealing:

1. **One throwaway container per video**, with the agent running as an unprivileged user. It's destroyed when the job ends. A cron job cleans up anything a crashed workflow left behind.
2. **No API key in the container.** Claude Code calls `http://anthropic.internal` and Codex calls `http://openai.internal/v1`, virtual hosts answered by the render Worker. The Worker adds the real key and forwards the call to Anthropic or OpenAI over HTTPS. Only a placeholder ever reaches the container.
3. **No database or storage credentials in the container.** The Worker reads job files out of the container and writes them to R2 through bindings. It updates Postgres through Hyperdrive.
4. **Cloned repos lose** `.claude/`, `.agents/`, `.codex/`, `.opencode/`, `CLAUDE.md`, `AGENTS.md` and `.mcp.json`, so a repo can't configure hooks, skills or instructions for either agent.
5. **Private-repo tokens never enter the container.** They're encrypted in the customer's browser and decrypted only by the render Worker, which downloads the repo itself (see "Private repositories" above).
6. **Limits on every video:**
   - a cost ceiling (`MAX_COST_PER_JOB_USD`), enforced by the Claude SDK; a fallback attempt gets only what's left
   - a turn limit, on both engines
   - a ~45-minute wall-clock limit per attempt
   - Any of these ends the job with a refund.
7. **Web checks:** Clerk on every non-public route, webhook signatures verified, URL validation, a pre-flight reachability check, and at most 3 active jobs per user.
8. **Provider accounts:** use a dedicated Anthropic workspace key and a dedicated OpenAI project key, each with a monthly spend limit. The OpenAI limit matters more, because Codex has no per-video dollar ceiling.

## Licensing

- **brag:** MIT. Keep `runner/skills/LICENSE.brag`.
- **Soundtrack:** `/brag-slim`, used by default, composes its own soundtrack, so the bundled-music licensing question doesn't come up.
- **If you enable the full `/brag` workflow:**
  - Hyperframes is Apache-2.0.
  - The bundled ende.app music is CC BY 4.0. Credit "Music by Sascha Ende (ende.app)", and never register outputs with YouTube Content ID.
  - Kenney sound effects are CC0.
