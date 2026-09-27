# Unit economics: tokens and dollars per video

All figures are **estimates until you run `npm run measure`**. The worker also meters every production job (tokens, cache, dollars, minutes), and `/admin` shows real cost of goods sold (COGS) per video.

## Where the tokens go in one brag-slim run

A video is one agent session. It inspects the source, writes `brag-plan.md`, writes the animation code, renders with headless Chromium, looks at stills, fixes problems, renders again, and delivers. Each agent turn re-sends the whole context, and prompt caching bills those repeats at about 10% of the normal input price.

| Driver | Typical size | Why |
|---|---|---|
| Base context (Claude Code harness + tools + skill) | ~20–25k tokens | Resent every turn, so almost all of it is billed as cache reads |
| Source material (site copy, CSS, repo files, screenshots) | 20–60k | Screenshots cost ~1.5k tokens each |
| Turns | 40–120 | Each tool call is one turn |
| Output (storyboard, HTML/JS scenes, scripts, fixes, thinking) | 50–160k | **The biggest cost on Opus** |
| Cache writes | ~2× final context, ×1.5 | Renders can take longer than the 5-minute cache TTL, so part of the context gets rewritten |

## Modeled cost per video (LLM only)

| Scenario | Turns / avg context / output | **Opus 5.5** ($4 in / $20 out / $0.20 cache read / $5 cache write) | **Sonnet 5** ($2 / $10 / $0.20 / $2.50) |
|---|---|---|---|
| Light (simple site) | 40 / 45k / 50k | **$2.04** | $1.19 |
| Typical | 70 / 70k / 90k | **$3.80** | $2.37 |
| Heavy (big repo, many fix loops) | 120 / 110k / 160k | **$7.38** | $4.94 |

Other costs:
- **Compute:** a Cloudflare `standard-4` container (4 vCPU, 12 GiB) running 10–20 minutes costs ~$0.07–0.13 (about $0.00011 per second).
- **Storage and egress:** on R2, ~$0.002.
- **Failures:** failed runs still burn tokens. Budget ~15% failures at launch, which adds that percentage to the cost of each delivered video.
- **Revisions:** these reuse the plan and composition. Estimate 35–50% of a new run, about $1.50–2 on Opus.

**Planning number: about $4.65 per delivered video on Opus 5.5 (Studio), about $2.90 on Sonnet 5 (Standard).** Both include compute and failure overhead. The per-job ceiling (`MAX_COST_PER_JOB_USD=8`) caps the tail.

**Measured so far (one run, so treat it as a first data point, not an average):**

| Date | Engine / model | Site | Result | Steps | Minutes | Tokens (input / output / cached) | Model $ | Total $ |
|---|---|---|---|---|---|---|---|---|
| 2026-09-26 | OpenAI `gpt-6-sol` (Codex) | brag example "Taxi for Taxis", 20s landscape | ✅ | 40 | 12.4 | 125k / 53k / 3.01M | $1.38 | **$1.47** |

- Caching does most of the work: 94% of input tokens were cache reads at a tenth of the price.
- At $1.47 a video, a $9 Standard video keeps about $6.40 after Dodo's fee (5.5% + 40¢) and the 15% failure allowance. That's about 71% gross margin. Confirm with more runs (5 examples plus 10 real products) and a Claude comparison before relying on it.

**60–90 second launch videos** (not measured yet): roughly 3–4x the scenes of a 20-second teaser, so estimate $4–7 on `gpt-6-sol`. They cost 4 credits (60s) or 6 credits (90s), against 2 for a teaser. They also get 2x the turns, 2.5x the dollar ceiling and a 90-minute limit per attempt.

**OpenAI engine (option and fallback):**
- `gpt-6-sol` has Sonnet 5's list prices ($2 in / $10 out / $0.20 cache read), so plan on about $2.90 a video until it's measured. Codex uses tokens differently from Claude Code, so run the benchmark.
- `gpt-6-astra` ($10 / $50 / $1) would be about 2.5× Opus, roughly $11–12 a video. That's more than the Standard price, and Codex has no dollar ceiling, so it's off by default.
- A fallback also pays for the failed first attempt. Most provider failures (bad key, outage) fail on the first call and cost almost nothing.

## Margin by plan

Prices are set in [PLAN.md](PLAN.md#pricing). They follow the lowest-price strategy with two quality tiers: Standard on Sonnet 5 and Studio on Opus 5.5.

Margins are after Dodo Payments' fees, assuming international cards: 5.5% + 40¢ on one-time payments, 6% + 40¢ on subscriptions. US cards cost 1.5 points less. Dodo costs about 2–3 margin points more than Stripe would; in exchange it handles global sales tax and VAT, invoicing, fraud and chargebacks as the merchant of record.

Cost per unit (estimated):

| Unit | Standard (Sonnet 5) | Studio (Opus 5.5) |
|---|---|---|
| New video | $2.90 | $4.65 |
| Revision | $1.20 | $1.95 |
| Extra format (vertical needs a full re-layout, so it costs more than a revision) | $1.60 | $2.55 |

| Plan | Price | What's included | Margin if every credit is used | Margin at typical use |
|---|---|---|---|---|
| Standard video | $9 | 1 video | 58% | 58% |
| Studio video | $19 | 1 video + 1 revision | 58% | 68% (revision unused) |
| Launch Kit (Studio) | $39 | 3 formats, 2 revisions | 58% | 64% (1 revision used) |
| Launch Kit launch-week promo | $29 | same | 46% | 52% |
| Creator | $19/mo | 3 Standard videos | 46% | 69% (half the credits used) |
| Pro | $49/mo | 10 Standard or 5 Studio | 34% (all Standard) to 46% (all Studio) | 64% |
| Agency | $149/mo | 30 Standard or 15 Studio | 35% to 47% | 65% |
| Extra Standard video | $7 | For subscribers | 47% | 47% |

Takeaways:
1. **Every product clears the floor we set:** at least 30% margin if every credit is used and about 60% or more at typical use. Standard carries the thinnest margin per credit, which is why Studio costs 4 credits.
2. **The lowest price only works if Standard costs about $3 or less.** Step 1 measures this. If Sonnet 5 videos cost more, or don't pass the quality bar, Standard moves to $12.
3. **Push cost down, then pass the savings on.** The levers, from the plan:
   - scene templates, 30–50% fewer output tokens
   - a pre-extracted site brief, 15–25% fewer turns
   - pre-flight checks, which cut failed renders
   - `CLAUDE_EFFORT=medium`
   Each one either raises margins or lets prices drop further.
4. **The free video is your acquisition cost.** It runs on Sonnet 5 at 15 seconds for about $2.40. If 60% of signups use it and 5% become paying customers, that's about $29 of token cost per paying customer. Keep the daily free-tier cap.
5. **Watch p90 cost, not the average.** A handful of 120-turn runs erase the margin on a Pro plan. `/dashboard/admin` shows p90.
6. **Never sell lifetime or unlimited plans.** Cost is per video, forever.

## How to measure (do this first; it costs ~$20–40)

```bash
npm run measure                                        # 5 upstream example sites, default model
CLAUDE_MODEL=claude-sonnet-5 npm run measure           # same sites on Sonnet 5
ENGINE=openai npm run measure                          # same sites on OpenAI (gpt-6-sol via Codex)
npm run measure -- https://yourfavorite.site https://github.com/owner/repo
```

The script writes `measurements/run-*.csv` and saves the MP4s next to it so you can compare quality against cost side by side. Then update:
- `COMPUTE_USD_PER_SECOND` in `packages/core/src/pricing.ts` for your host
- plan prices and credits
