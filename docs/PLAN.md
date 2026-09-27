# Launch plan: execution, go-to-market, pricing

Proposed plan starting Monday, September 28, 2026. Every number is an estimate until Step 1 measures the real cost per video. Market sources are in [STRATEGY.md](STRATEGY.md); the cost model is in [UNIT_ECONOMICS.md](UNIT_ECONOMICS.md).

**The short version:**
1. Prove cost and quality in 3 days.
2. Pick a real name and close the product gaps in 2 weeks.
3. Run a private beta with 30 makers and build a gallery.
4. Launch publicly on Thursday, November 5, from $9 a video, leading with a $39 Launch Kit.
5. By December 20, ship automatic release videos from GitHub. This is the feature that turns one-time buyers into subscribers.

## Three facts that shape the plan

1. **"LaunchReel" is taken.** Three products already use the name:
   - [gudlab/launchreel](https://github.com/gudlab/launchreel), an open-source tool that turns websites into launch videos
   - [launchreel.app](https://launchreel.app/)
   - [launchreel.pro](https://launchreel.pro/)

   So are [Shipreel](https://github.com/Chinteyley/shipreel) and [LaunchCut](https://www.launchcut.io/), both in this exact space. Choose a distinctive name before spending anything on marketing.
2. **The low end of the market is crowded and cheap.** HeyGen gives the first video free, Rendrio charges $9, and LaunchCut.io and open-source clones exist. Don't compete on price. Compete on:
   - quality
   - the multi-format Launch Kit
   - release-video automation
3. **No lifetime deals, no unlimited plans.** Every video costs $2–7 in tokens, so "lifetime" means unlimited cost. This replaces the AppSumo idea in the earlier strategy.

## Step-by-step plan

| # | Step | When | Done when |
|---|---|---|---|
| 1 | Prove cost and quality | Sep 28–30 | ≥80% of runs succeed; ≥7 of 10 real-product videos are postable; median cost ≤$5 per video |
| 2 | Name, accounts, legal | Week 1 (to Oct 4) | Name and domain secured; accounts live; Terms, Privacy and Refund pages published |
| 3 | Close the product gaps | Weeks 1–2 (to Oct 11) | A stranger can go sign up → free video → pay → Launch Kit → share, end to end |
| 4 | Production deploy on Cloudflare | Oct 9–11 | 10 production runs pass; a forced failure refunds credits; a prompt-injection test repo finds no secrets |
| 5 | Private beta and gallery | Weeks 3–4 (Oct 12–25) | ≥70% of videos postable; 5 testimonials; 3 full-price sales; 50-video gallery |
| 6 | Pre-launch marketing | Weeks 2–5 (Oct 5–Nov 1) | 1,000 waitlist emails; 150 made-for-you videos sent |
| 7 | Public launch | Week 6 (Nov 2–8); Product Hunt on Thu Nov 5 | By Nov 30: 1,500 signups, ≥5% free→paid, 75 paying customers |
| 8 | Recurring videos (the moat) | Weeks 7–12 (Nov 9–Dec 20) | $4k MRR; 30% of paying customers made 2+ videos; churn <8% a month |
| 9 | Scale channels | Months 4–6 (Jan–Mar 2027) | $12k MRR by Mar 28, 2027 |
| 10 | Weekly operating rhythm | Always | Metrics reviewed every Monday |

### Step 1: Prove cost and quality (Sep 28–30)
- Create a dedicated Anthropic workspace and API key with a $300 monthly spend limit. Also create an OpenAI project key with its own limit, for the fallback engine.
- Install FFmpeg and Playwright Chromium locally, then run `npm run measure` on:
  - the 5 upstream examples, once on Opus 5.5, once on Sonnet 5 and once on OpenAI (`ENGINE=openai`)
  - 10 real products (5 websites, 5 GitHub repos) from recent Product Hunt and Show HN launches
- Also test rendering all three formats in one run against re-rendering per format. The cheaper option decides how the Launch Kit is built.
- You and two other people score each video on one question: would the maker post it?
- If quality fails, fix the prompt and skill before anything else. If cost fails, move more of the run to Sonnet 5 or lower the effort setting.
- Budget: ~$100–150 of API usage.

### Step 2: Name, accounts, legal (week 1, in parallel)
- **Name** — check all of these:
  - coined or distinctive
  - .com or .dev available
  - no USPTO conflict in classes 9 and 42
  - no product with the same name on GitHub or Product Hunt

  Every launch/ship/reel/cut combination I checked is taken.
- **Accounts:**
  - **Cloudflare**, on the $5/month Workers Paid plan. It covers Workers, Workflows, Containers, R2, Hyperdrive and Email Service.
  - Anthropic, OpenAI, Dodo Payments, Clerk, Neon, Sentry, PostHog.
  - Dodo is the merchant of record, so it collects and remits sales tax and VAT for you.
- **Payments approval (start day 1):** Dodo puts AI content-generation tools through extra review, and its policy forbids impersonation, scraping and deepfakes. Email compliance@dodopayments.com explaining:
  - customers submit only products they own or are authorized to promote
  - videos show product UI and copy: no real people, no cloned voices
  - models come through Anthropic's and OpenAI's APIs
  - adult content is blocked

  Live payments wait on this approval. Build and test in Dodo's test mode meanwhile.
- **Legal pages:**
  - Terms: the customer must own the product or be authorized to promote it.
  - Privacy policy.
  - Refunds: failed renders refund credits automatically; cash refund within 7 days if nothing was downloaded.
  - Acceptable use.
- **Partnership:** email the brag maintainer this week (see Go-to-market).

### Step 3: Close the product gaps (weeks 1–2; Claude Code builds these)
1. New prices and products in `packages/core/src/pricing.ts` and the Dodo dashboard:
   - Single video and Launch Kit
   - Pro at 20 credits
   - extra video for subscribers
   - annual prices
   - one-month credit rollover
2. Free tier:
   - Sonnet 5, 15 seconds, watermarked
   - one per person (GitHub or Google sign-in only)
   - a daily cap, with paid jobs jumping the queue
3. Changing format on a revision, which the Launch Kit's vertical and square cuts need.
4. A public share page per video (`/v/<id>`) that plays inline when posted on X, LinkedIn or Slack, with a "Make yours" button.
5. A "your video is ready" email plus a three-email onboarding sequence.
6. Abuse controls:
   - an ownership checkbox (✅ built, enforced by the API)
   - a block list of famous-brand domains on the free tier
   - a block list of adult sites (Dodo's policy forbids explicit content, real or AI-generated)
   - a takedown contact
7. Concierge mode for the beta: paid videos wait for your approval in `/admin` before delivery.
8. PostHog funnel events and Sentry error tracking.
9. Replace the placeholder name everywhere, including the watermark.

### Step 4: Production deploy on Cloudflare (Oct 9–11)
Follow the Deploy section in the README.
- Neon database, Hyperdrive config and R2 bucket (with a public custom domain for videos).
- Deploy the render Worker, which includes the container image, then the web Worker.
- Anthropic and OpenAI keys, each with its own spend limit, stored only as secrets on the render Worker. They never enter a container.
- At least two weeks before launch, ask Anthropic for a rate-limit increase sized for about 20 renders at once. Set `max_instances` in `render/wrangler.jsonc` to match.
- Dodo live mode once verification is approved. Webhook signature checks are already built and tested.
- Tests:
  - 10 production runs
  - one forced failure (the credits must come back)
  - one repo containing prompt-injection text: the agent must find no API key and no database or storage credentials

### Step 5: Private beta and gallery (Oct 12–25)
- Recruit 30 beta users:
  - makers who launched in the last month or are about to (Product Hunt, Show HN, X, YC Launches)
  - 2–3 agencies
- Each gets a free Launch Kit. In exchange: a 15-minute call, permission to show the video, and a testimonial if they like it.
- Approve every video yourself before it's delivered. Log each failure and fix the top three causes every week.
- Build a public gallery of 50 videos across categories and tones.
- Engineering during the beta:
  - Retry a render once automatically if Cloudflare restarts its container.
  - Build the first cost-down lever measured in Step 1. See Pricing.

### Step 6: Pre-launch marketing (Oct 5–Nov 1)
- Landing page with the gallery, pricing and a waitlist. Goal: 1,000 emails.
- Build in public on X: one real video a day, and one numbers post a week.
- **Made-for-you outreach:**
  - Make 150 watermarked videos (Sonnet 5, about $2.50 each).
  - Targets: makers on Product Hunt's Upcoming list, YC Launches, Show HN, and "launching soon" posts on X.
  - Send each maker a personal message with their video and a Launch Kit offer.
  - Goal: 10–15% buy.
- Give free credits to about 15 creators who already covered brag or Claude Code.
- Prepare the Product Hunt page: our own launch video (made by the product), gallery images, a maker comment, and an FAQ first comment.

### Step 7: Public launch (Nov 2–8)

| Day | Action |
|---|---|
| Mon Nov 2 | Final checks: rate-limit headroom, free-tier cap, gallery live, Product Hunt page scheduled |
| Tue Nov 3 | Stay quiet: it's US election day. Email the waitlist: "launching Thursday" |
| **Thu Nov 5** | Product Hunt at 12:01am PT. Waitlist email, X thread with 4 videos, LinkedIn post. Tell beta users and creators. Answer every comment all day |
| Fri Nov 6 | Reddit (r/SideProject, r/SaaS, r/indiehackers — follow each subreddit's rules) and an Indie Hackers post with real numbers |
| Wed Nov 11 | Show HN, leading with the open-source story and credit to brag |

Launch offer: Launch Kit for $29 through Sunday, Nov 8.

### Step 8: Recurring videos, the moat (Nov 9–Dec 20)
- **GitHub App:**
  - On every GitHub release, draft a 15–20 second video from the release notes and the diff.
  - One click to approve; optional auto-post to X and LinkedIn.
  - This is what makes a subscription worth keeping.
- **Brand kit:** logo, colors, fonts and voice saved per workspace, so every video matches the last one.
- **Social cut-down pack:** 6–10 second clips with captions for each platform.
- **Agency features:** client workspaces, white-label share pages, API.
- **Second launch moment** for the GitHub App: Show HN, X, developer newsletters.

### Step 9: Scale channels (Jan–Mar 2027)
- Referral program: give 2 credits, get 2 credits.
- Partner programs:
  - agencies: 20% recurring on customers they refer
  - accelerators: cohort packs for demo day
  - vibe-coding communities: Lovable, Bolt, Replit
- A cloud-render skill for Claude Code and Cursor: the /brag experience with no local setup, billed in credits.
- SEO: gallery pages and "launch video examples" guides.
- A $1–2k paid-ads test, only once conversion rates are known:
  - Google search ads on terms like "product launch video" and "SaaS demo video"
  - X and Reddit ads aimed at makers
- Optional: a +$99 human-polish add-on, if buyers ask for it.

### Step 10: Weekly operating rhythm
- **Monday — metrics:**
  - signups, activation, free→paid
  - paid videos, render success rate
  - average and p90 cost per video
  - MRR, churn
- **Tuesday–Thursday:** ship.
- **Friday:** add to the gallery, post a build-in-public update, do three customer calls.
- **Monthly:** pricing and cost review. Re-measure whenever Anthropic or OpenAI ships a new model or changes prices.

## Pricing

Your direction: the best service at the lowest price. So there are two quality tiers:
- **Standard** runs on Claude Sonnet 5, at the lowest price in the market.
- **Studio** runs on Claude Opus 5.5, for the best quality, still far below freelancers.

| Plan | Price | Includes | Our cost (est.) | Gross margin |
|---|---|---|---|---|
| Free | $0 | 1 Standard video, 15s, watermarked | ~$2.40 | Acquisition cost |
| Standard video | **$9** | 1 video up to 30s, no watermark | ~$2.90 | 58% |
| Studio video | $19 | 1 Studio-quality video + 1 revision | $4.65–6.60 | 58–68% |
| **Launch Kit** (hero offer) | **$39** | 1 Studio video in 16:9 + 9:16 + 1:1, 2 revisions, share copy per platform | $11.70–13.65 | 58–64% |
| Creator | $19/mo | 6 credits: 3 Standard videos | up to $8.70 | 46% at full use, ~69% typical |
| Pro | $49/mo | 20 credits: 10 Standard or 5 Studio videos; priority queue; brand kit\*; GitHub release videos\* | up to $29 | 34–46% at full use, ~64% typical |
| Agency | $149/mo | 60 credits: 30 Standard or 15 Studio videos; white-label\*; client workspaces\*; API\* | up to $87 | 35–47% at full use, ~65% typical |
| Extra Standard video | $7 | For subscribers | ~$2.90 | 47% |

How to read the table:
- \* These features ship in Step 8 (by Dec 20). Until then, Agency is invite-only.
- Margins are after Dodo Payments' fees, assuming international cards: 5.5% + 40¢ on one-time payments, 6% + 40¢ on subscriptions. US cards cost 1.5 points less.
- "Typical" assumes customers use half their credits.
- Costs include about $0.10 of Cloudflare compute per video. The breakdown is in [UNIT_ECONOMICS.md](UNIT_ECONOMICS.md#margin-by-plan).
- **These prices depend on Step 1:** Sonnet 5 must pass the quality bar for Standard, and Standard must cost about $3 or less per video. If it doesn't, Standard moves to $12.

**Pricing rules:**
- Credits: a Standard video costs 2, a Studio video costs 4, and a revision or extra format costs 1. Unused credits roll over one month.
- Never price below a 30% margin at full use or a 60% margin at typical use.
- One-time purchases cost more per video than subscriptions, which nudges repeat buyers to subscribe.
- Annual billing: 2 months free.
- Failed renders are refunded automatically.
- Refund quickly when a customer asks: a refund costs $1, a chargeback $30.
- As the cost-down work lands, cut prices further instead of pocketing the margin. That's how the lowest price stays sustainable.

**How the cost per video comes down:**

| Lever | Expected saving | Status |
|---|---|---|
| Cloudflare: ~$0.10 of compute per video, no fees for serving video downloads | Already the cheapest option | ✅ built |
| Pre-flight check: unreachable sites and private repos rejected before any tokens are spent | Fewer wasted renders | ✅ built |
| Standard tier on Sonnet 5 | About 40% cheaper than Opus 5.5 | ✅ built (per-plan model routing) |
| Free videos capped at 15 seconds on the cheaper model | Lower acquisition cost | ✅ built |
| Scene templates the agent fills in instead of writing all the code | 30–50% fewer output tokens, the biggest cost | 🔜 after Step 1 |
| A site brief captured by cheap code before the agent starts | 15–25% fewer exploring turns | 🔜 after Step 1 |
| Approve the storyboard before rendering | Fewer paid revisions | 🔜 Step 8 |

**Why these numbers:**
- **The lowest entry price in the market:**
  - Standard at $9 matches Rendrio, the cheapest competitor, but is built from your real UI and includes share copy.
  - Creator at $19/mo undercuts HeyGen and Motion.so ($29) and RepoClip ($24).
- **Studio quality at $19–39** is 5–10× cheaper than a Fiverr explainer ($170–350) and 60× cheaper than an agency ($2.5k and up).

## Go-to-market

**Positioning:** "Launch videos made from your real product, from $9, in 15 minutes." The gallery is the proof.

| Segment | Offer | Message | Where to find them |
|---|---|---|---|
| Indie makers, vibe-coders | Free video → $9 Standard or $39 Launch Kit | "Your Product Hunt launch video in 15 minutes, in every format." | X, Product Hunt Upcoming, Show HN, r/SideProject, Indie Hackers |
| Seed–Series A SaaS teams | Pro | "A video for every release, straight from your repo." | YC Launches, LinkedIn, developer newsletters |
| Devtools and open source | Starter or Pro, plus the GitHub App | "Turn your README and releases into videos." | GitHub, Hacker News, Discord communities |
| Agencies, freelancers | Agency | "Add a launch video to every client project: white-label, about $5 each." | Webflow and Framer communities, LinkedIn, agency directories |

### Channels, in order

| Phase | Channel | Cost | Expected result (estimate) |
|---|---|---|---|
| Pre-launch | Made-for-you videos sent to makers | ~$375 for 150 videos | 15–20 paying customers, plus gallery material |
| Pre-launch | Build in public on X; creator seeding | Time + credits | Waitlist of 1,000 |
| Launch | Product Hunt, Show HN, Reddit, Indie Hackers | Time | 1,500 signups in November |
| Ongoing | Watermark and share pages; referral credits | Free-tier cost | Each shared video brings in more makers |
| Month 2+ | GitHub App release videos | Build time | Recurring subscribers; every posted release video advertises us |
| Month 3+ | Partners: brag maintainer, agencies, accelerators, vibe-coding communities | Revenue share | Steady flow of new signups |
| Month 4+ | Search ads, SEO | $1–2k test | Keep only if acquisition cost is under 1/3 of a customer's 6-month value |

### Growth loops
1. Free videos carry a watermark and a share page with a "Make yours" button.
2. Paid customers who keep a small "made with" credit get 1 bonus credit.
3. Referral: give 2 credits, get 2 credits.
4. GitHub App release videos are posted publicly, with credit.

### The partnership to try first
Offer the brag maintainer an "official hosted version" arrangement: revenue share or sponsorship, in exchange for a link from the README. brag's ~8.3K stars and its viral moment in June 2026 are the strongest distribution asset in this space. If the maintainer plans their own hosted product, you want to know in week 1.

## Targets

| Milestone | Date | Target |
|---|---|---|
| Cost and quality gate | Sep 30 | ≥80% success, ≥7 of 10 postable, median ≤$5 per video |
| Beta complete | Oct 25 | 30+ beta videos, 5 testimonials, 3 full-price sales |
| Launch month | Nov 30 | 1,500 signups, 100 paying customers, ~$2.5k revenue |
| Month 3 | Dec 20 | $3k MRR plus one-time sales |
| Month 6 | Mar 28, 2027 | $10k MRR |
| Month 12 | Sep 2027 | ~$28k MRR in the base case: about 800 paying customers at ~$35 average revenue each. Lower prices mean more customers per dollar (see STRATEGY.md) |

## Budget for the first 90 days

| Item | Cost |
|---|---|
| Claude API not covered by revenue: measurement, beta, 150 outreach videos, free tier | ~$2,500–3,500 |
| Infrastructure: Cloudflare Workers Paid ($5/mo), container time for unpaid renders (~$0.10 each), Neon, R2 | ~$100–250 |
| Domain, email, legal templates | ~$100–500 (optional lawyer review: $500–1,500) |
| Paid marketing | $0 until month 4 |
| **Total cash** | **~$2,800–4,300**, not counting your time |

## Who does what

**You:**
- name and domain
- account and payments setup
- legal pages
- beta recruiting and customer calls
- outreach messages
- launch-day presence
- partnerships
- support

**Claude Code:**
- measurement runs and analysis
- every code change in Steps 3, 4, 5 and 8 (the Cloudflare version with isolated containers and key injection is already built)
- deployment configuration
- the landing page, gallery and share pages
- emails
- the GitHub App
- admin dashboards
- drafts of all copy: landing page, Product Hunt page, outreach templates, emails
- our own launch video, made with the product

Minimum team: you plus Claude Code. Add a part-time motion designer once the human-polish add-on sells.

## Risks

| Risk | Mitigation |
|---|---|
| HeyGen and cheap clones commoditize "URL to video" | Lowest entry price on the cheapest infrastructure, plus Studio quality, the Launch Kit and release-video automation. Keep margins through the cost-down work, not by raising prices |
| Inconsistent video quality | Concierge review in the beta, automatic refunds, weekly fixes for the top failure causes, p90 cost alerts |
| Token costs above plan | $8 cap per job, Sonnet 5 for Standard and free videos, measure before pricing, monthly review, no lifetime deals. If Standard costs more than ~$3, move it to $12 |
| Prompt injection from customer repos and sites | Built in: one throwaway container per video, no API key or credentials inside it, key added by the Worker at egress. Verified by the Step 4 test repo |
| Launch-day load or rate limits | Request the rate-limit increase early, priority queue for paid jobs, daily free-tier cap |
| Videos of products the user doesn't own | Ownership checkbox, famous-brand block list, takedown process |
| Dodo approval delayed or denied (AI video tools get extra review) | Email Dodo compliance in week 1. Payments code is isolated in `web/lib/dodo.ts` and two routes, so switching to a backup such as Paddle is a small change |
| Upstream changes (brag, Anthropic models and prices) | Vendor and pin the skill; the model is a config value; re-measure after every change |
