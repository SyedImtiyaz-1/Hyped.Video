# Hyped: launch videos as a service

A paid web app built on [latent-spaces/brag](https://github.com/latent-spaces/brag) (MIT), running on Cloudflare.

1. A customer pastes a website or a GitHub repo (public, or private with a saved token).
2. They get a launch video: a 15–30 second teaser for social, or a 60–90 second launch video for their homepage. MP4, poster image and share copy.
3. They can ask for revisions in plain English.

The product is **Hyped**, at **[hyped.video](https://hyped.video)**. Logo: the "Hype Burst" (lime `#C8F135` on near-black `#0A0A0A`), in `web/components/logo.tsx`, with the browser-tab icon, iPhone icon and link-preview image in `web/app/` and a brand kit (SVG + PNG, including a 240×240 Product Hunt thumbnail) in `web/public/brand/`. The name lives in `web/lib/brand.ts` and `render/wrangler.jsonc` (`BRAND_NAME`); internal code names (the `launchreel` folder, `@launchreel/core`) are unchanged and never shown to customers. Don't sell under the "brag" name: the code is MIT-licensed, but the name belongs to the upstream project.

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

## Standard and Studio

Customers pick a quality tier, and each tier always runs on one engine: Claude (Claude Agent SDK) or OpenAI (Codex CLI). Customers only ever see the tier names. Set the engines with vars in `render/wrangler.jsonc`:

| Var | Default | What it does |
|---|---|---|
| `STANDARD_ENGINE` / `STANDARD_MODEL` | `openai` / `gpt-6-sol` | The budget tier, and every free-trial video |
| `STUDIO_ENGINE` / `STUDIO_MODEL` | `claude` / `claude-opus-5-5` | The premium tier for flagship launches. It uses 3× the credits (`QUALITY_CREDIT_MULTIPLIER` in `packages/core/src/pricing.ts`) |

- There is no fallback between engines. A render that fails is refunded.
- Studio needs a working Anthropic key. `npm run keys` tells you whether each key works: valid, has credit, and can use the model.
- `gpt-6-sol` has the same list prices as Sonnet 5. `gpt-6-astra` is closer to Opus but costs 2.5× as much. Codex also has no per-video dollar ceiling (the Claude SDK does), so measure before switching to it.

## Private repositories

Customers can make videos from private GitHub repos. They paste a read-only, fine-grained GitHub token in the field right under the repo link on the New video page. It's saved (encrypted), so later videos and revisions of that repo work without pasting it again.

How the token is protected:
1. **Encrypted in the customer's browser.** The browser encrypts it to the render Worker's public key (ECDH P-256 + AES-256-GCM) before anything is sent. The web Worker and the database only ever get ciphertext. `packages/core/src/repo-token.ts` holds the scheme.
2. **Only the render Worker can decrypt it.** Its private key is a Cloudflare secret (`REPO_TOKEN_PRIVATE_KEY`). Cloudflare secrets can't be read back from the dashboard or the API.
3. **Decrypted only to download.** The render Worker decrypts the token for a single request to GitHub, streams the repo into the container as files, and drops the token. It never enters the container, a workflow step result or a log.
4. **Bound to the customer.** The ciphertext is tied to the customer's user id. Copied to another account in the database, it won't decrypt.
5. **Least privilege.** Customers are asked for a fine-grained token with *Contents: read-only* on selected repos and an expiry. They can remove or replace it on the New video page, or revoke it on GitHub at any time.

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
   npx wrangler hyperdrive create hyped-db --connection-string="<neon url>" --caching-disabled
   ```
   - `--caching-disabled` matters. Hyperdrive otherwise caches reads for up to 60 seconds and doesn't clear the cache on writes, so credit balances and video status would go stale.
   - Paste the Hyperdrive ID into `web/wrangler.jsonc` and `render/wrangler.jsonc`.
2. **Storage:** create the bucket:
   ```bash
   npx wrangler r2 bucket create hyped-videos
   ```
   Then connect the custom domain **media.hyped.video** to it (R2 → the bucket → Settings → Custom domains). `PUBLIC_VIDEO_BASE_URL` in `render/wrangler.jsonc` already points there.
3. **Render Worker:** set the model keys: `OPENAI_API_KEY` for Standard and `ANTHROPIC_API_KEY` for Studio.
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
- **Products.** Create 3 one-time products, the credit packs Starter, Creator and Pro (contents, USD and rupee prices: `PACKS` in `packages/core/src/pricing.ts`). Put their IDs in `DODO_PRODUCT_STARTER`, `DODO_PRODUCT_CREATOR` and `DODO_PRODUCT_PRO` (`npm run dodo` asks for them). India pays fixed rupee prices, GST included, through Dodo's Localized Pricing. There are no subscriptions.
- **Webhook.** Point it at `https://<your-app>/api/dodo/webhook` and put its secret in `DODO_PAYMENTS_WEBHOOK_KEY`. Subscribe it to `payment.succeeded`, `refund.succeeded`, `dispute.opened` and `dispute.won`.
- **How purchases become credits.** Every grant is idempotent, so duplicate webhook deliveries are safe.
  - A pack grants its credits on `payment.succeeded`. Credits never expire.
  - Refunds and disputes take back unspent credits.

## Security

The agent runs shell commands with `bypassPermissions` on **untrusted input**: customer repos and websites can contain prompt injection. So the render container holds nothing worth stealing:

1. **One throwaway container per video**, with the agent running as an unprivileged user. It's destroyed when the job ends. A cron job cleans up anything a crashed workflow left behind.
2. **No API key in the container.** Claude Code calls `http://anthropic.internal` and Codex calls `http://openai.internal/v1`, virtual hosts answered by the render Worker. The Worker adds the real key and forwards the call to Anthropic or OpenAI over HTTPS. Only a placeholder ever reaches the container.
3. **No database or storage credentials in the container.** The Worker reads job files out of the container and writes them to R2 through bindings. It updates Postgres through Hyperdrive.
4. **Cloned repos lose** `.claude/`, `.agents/`, `.codex/`, `.opencode/`, `CLAUDE.md`, `AGENTS.md` and `.mcp.json`, so a repo can't configure hooks, skills or instructions for either agent.
5. **Private-repo tokens never enter the container.** They're encrypted in the customer's browser and decrypted only by the render Worker, which downloads the repo itself (see "Private repositories" above).
6. **Limits on every video:**
   - a cost ceiling (`MAX_COST_PER_JOB_USD`), enforced by the Claude SDK
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
