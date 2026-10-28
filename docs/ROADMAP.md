# Roadmap: building Hyped, with Cardboard as the inspiration

Draft for decisions, 27 October 2026. Taibanaz decides; Syed reviews and deploys. It builds on Syed's plan
"Hyped – what to build next" (26 October) and on the code on `launch/caption-styles`. Sizes: S is days, M is one to
three weeks, L is a month or more.

## In one minute

Cardboard is an AI video editor for growth teams (YC W26). You bring footage, its agent (the "Director") makes the first
cut, and you finish in a chat-plus-timeline editor. It ships every week. Its newest bets are Recipes (finished edits
you remix), photos-to-video with generated clips, and editing from inside ChatGPT and Claude.

Hyped starts from the other end: it makes the footage, from your real product (a website or repo), and it edits your own
clips into reels with the best captions we know of. That's our edge. Cardboard can't make a video of your product
without footage, and HeyGen's website-to-video has no editor and no reels.

**The plan:** become the place builders make every video about their product. One box takes a link, a repo, clips,
photos or a reference video. A recipe and an agent make the first cut. A real editor finishes it.

1. **Now (S):** ship the landing refresh and the product video editor, fix the production media outage, and unblock local renders.
2. **Next (M):** Recipes v1 and several uploads per video, behind one prompt box.
3. **Then (L):** one editor for everything: a multi-track timeline, layouts and a Director that shows its steps.
4. **Then (M):** Premium: 4K and 60 fps exports, generated B-roll on credits, and Studio.
5. **Alongside (M):** the public API, then an MCP server and Claude and ChatGPT plugins.

## What Cardboard is, and how fast it moves

- **Product:** browser editor (cloud render) plus a Mac app (local editing; bring your own Claude or Codex agent).
  Footage first: upload clips, describe the video, get a cut, refine in chat or on the timeline.
- **Recipes:** 11 public recipes so far, by category (UGC, Vlog, Effect, Clipping, Viral trends, Talking-head, Product
  showcase), each with a sample video and a Remix button. Recipes take mixed video, photo and audio and can be shared by link.
- **Editor:** asset library, layout slots, text and caption toolbars on the canvas, 21 caption styles (9 behind the
  speaker), color controls, 3D graphics, background removal, ProRes, 4K.
- **Director:** checks its result against the request and says what it couldn't do, reports when it's stuck, matches a
  reference video's color, pacing, fonts and audio, asks before using footage that doesn't fit.
- **Generation:** clips from prompts or photos on generative credits (Hailuo and Kling on lower plans; Kling 3 and Veo
  higher up), with a cost preview before it spends.
- **Distribution:** ChatGPT and Claude plugins (26 Oct), an MCP server and CLI for agents.
- **Pricing:** monthly plans, Lite $10 to Pro $250 a month (cheaper yearly); 400–5,000 generative credits.
- **Pace:** 14 releases between 27 July and 26 October 2026, one a week.

## Where Hyped stands

| | Hyped today | Cardboard |
|---|---|---|
| Starting point | Website or repo (product videos), one clip (reels) | Your footage, a prompt, a reference |
| Making footage of your product | ✅ from the real UI, copy, colors and fonts | ❌ needs footage |
| Ready-made formats | 10 templates, no gallery of samples | Recipes gallery with samples, remix, sharing |
| Inputs per video | One link or one clip | Many clips, photos, audio |
| Editor | Reel editor: captions, cuts, B-roll, emojis, effects, filters, audio, Ask AI | Multi-track timeline, layouts, canvas tools, Director |
| Captions | 18 styles, 18 fonts, 7 animations, boxes, stroke, shadow | 21 styles, 9 behind the speaker |
| AI edits | Ask AI: any change the editor can make, checked and undoable, free | Director: multi-step, self-checking, references |
| Generated footage | ❌ | ✅ on credits |
| Export | 1080p MP4 | Up to 4K, MP4/MOV/ProRes, timeline to Premiere/Final Cut/Resolve |
| Developers | No public API | MCP, CLI, Claude and ChatGPT plugins |
| Price | Pay once, credits never expire, rupee prices with UPI | Monthly subscription |
| Platforms | Any browser | Browser + Mac app |

Also true today: the product video editor exists only on Syed's machine (no branch on GitHub has it), and on 27 October
`media.hyped.video` answered every request with Cloudflare error 1101, so the live site's example videos were broken.

## What to take, what to keep, what to skip

**Take from Cardboard:**
- Recipes as the front door, each with a sample video and a remix button.
- One prompt box that understands links, files and plain words.
- An agent that shows its steps and checks its own work.
- A timeline editor for the last 10%.
- Credits shown before anything expensive runs.
- Living where builders already are (Claude, ChatGPT, the terminal).

**Keep what's ours:**
- Footage made from the real product.
- Repo input and developer workflows (PR and changelog videos, the GitHub App in PLAN step 8).
- Captions and reels.
- Pay-once credits and rupee pricing.
- Browser-first, so it works on Windows.

**Skip:**
- A desktop app.
- "Bring your own AI account".
- Copying their recipes or samples one to one.
- Formats built on TV clips, celebrities or other people's shows (a rights risk for us and our customers).

## Plan

### Phase 0: clear the decks (S, this week)
- Ship the landing page refresh (`launch/landing-refresh`: hero create box with format chips, moving examples strip, feature cards).
- Syed pushes the product video editor branch; we test it locally, then he deploys (his plan's step 0).
- Syed fixes `media.hyped.video` (error 1101).
- Finish the local render image build so videos can be tested end to end.

### Phase 1: Recipes v1 and several uploads (M, 2–3 weeks)
- **Recipe** = today's `Template` plus required inputs (files and text fields), a sample video, shape and length, tier, and
  whether it's a product video or a reel. Start with the 10 templates and the reel edit styles, then the 10 recipes in Syed's plan.
- **Gallery page** by category, with samples that play on hover (the new `ShowcaseMarquee` and `ExampleVideo` already do this), and
  Remix opening the form with the recipe filled in (the new hero chips already route to `/dashboard/new?template=`).
- **Several uploads per video:** photos, logo, headshot, screen recording, face-cam clip, reusing the reel multipart upload
  (`/api/reels/uploads`). The agent's job spec (`packages/core/src/contract.ts`) gains an `assets` list.
- **Recipe panel** (as in Cardboard's, from Syed's screenshots): the sample video on the left; on the right the pitch,
  "works best with" (Standard or Studio), a file drop that says how many it wants ("3–20 files"), the text fields,
  an optional "Anything to change?", shape and length, and Remix. Recipes that need extra credits say so before Remix.
- **One prompt box** on the home page and dashboard: a small, cheap model call turns "link + files + words" into a recipe and
  a filled form, which the customer confirms before spending credits.
- Done when a visitor can pick a recipe, add a link and three photos, and get a video without touching the 5-step form.

### Phase 2: one editor for everything (L, 4–6 weeks)
- **Edit model v2.** `ReelEdit` (`packages/core/src/reel.ts`) is one source clip keyed by its words. v2 adds tracks and clips:
  video clips from several sources with in and out points, overlays (B-roll, images, titles), captions, music and SFX, and
  **layouts** (split screen, picture-in-picture, side by side). `version: 2`, with a converter from v1 so every reel stays editable.
  Keep today's rule: one description drives both the preview and the render (`timeline.ts`, `wordMotion`).
- **Editor layout:** library | preview | Director chat, with a multi-track timeline underneath and tabs for open projects.
  Product videos and reels open in the same editor (as Syed's "Edit video" already does).
- **Director:** grow Ask AI (`reel-chat.ts`, already validated and undoable) into multi-step jobs that show each step,
  check the result against the request, and say what's left. Reference videos ("make it like this") come in here.
- **Titles and looks:** 5–6 title designs and lower thirds; about 10 more looks, as ffmpeg filters that already exist.
- Done when a founder can put a product scene and their face-cam clip in a split screen, retime it on the timeline, and
  fix the rest in chat.

### Phase 3: Premium (M, 2–3 weeks; measure first)
- **4K and 60 fps exports, MOV, the 4:5 shape, priority rendering:** measure render time and cost on `standard-4` first; 4K is
  several times the container work of 1080p. An export dialog like Cardboard's: resolution, clean or watermarked, frame rate, format.
- **Generated B-roll on credits,** with the cost shown before it runs. Published API rates in mid-2026 were roughly $0.03–0.25 a
  second depending on the model and resolution (Veo 3.1 Lite at the low end; Kling 3.0 and Seedance 2.0 around $0.09–0.11;
  premium tiers higher), so a 5-second shot costs about $0.15–1.25. Check each provider's own price page before choosing.
- **Studio** (the Claude engine) out of "coming soon".
- **Price:** keep pay-once packs; Premium exports and generated shots spend extra credits. No subscription needed.

### Alongside: developers and distribution (M)
- **Public API v1:** personal API keys in Settings, `POST /v1/videos`, `POST /v1/reels`, status and download, and a webhook when
  a video finishes, all on the same credits (Syed's proposal; `ApiKey` is already a planned entity in ARCHITECTURE).
- **MCP server and Claude/ChatGPT plugins** on top of the API: "make a launch video of this repo" from inside the agent a
  builder already uses. This fits our audience (indie hackers, devtools) better than Cardboard's.
- **GitHub App:** release → draft video → approve (PLAN step 8). Recurring videos are the moat in STRATEGY.

## How this differs from Syed's plan

Syed's plan (26 Oct) and this one agree on the goal and on most of the work. Four differences, each a decision below:

| | Syed's plan | This plan | Why |
|---|---|---|---|
| One prompt box | Last (step 4) | With Recipes (Phase 1) | It's a small model call on top of forms we already have, and it's the front door Cardboard leads with. The new hero chips are a first step. |
| Editor vs Premium | Premium (step 2) before pro editor tools (step 3) | Editor (Phase 2) before Premium (Phase 3) | Layouts and several clips unlock 3 of the first 10 recipes (Split-screen Talking-head, Redline Vlog, Screen Product Demo with a face cam). Premium needs a 4K cost test first. Syed's order earns money sooner. |
| Edit model | Not named | Edit model v2 (tracks, clips, layouts) | Layouts, several clips and titles all need it; designing it once avoids three rewrites of the reel model. |
| Developers | Not in the plan | Public API, MCP, plugins alongside | Syed offered the API on 27 Oct; Cardboard shipped Claude and ChatGPT plugins on 26 Oct; builders are our audience. |

## Risks

- **Pace:** Cardboard ships weekly; we're a small team. Pick fewer things and finish them. Phase 2 is the biggest risk of the plan.
- **HeyGen:** website-to-video inside its Video Agent, first try free, and HyperFrames is open source. Our answer is the
  editor, reels, recipes and developer workflows, not URL-to-video alone.
- **Generated footage cost:** the price per second varies 8× between models, and failed generations still cost. Show
  the price first, cap per job, refund failures.
- **4K render cost and time:** measure before promising.
- **Dev speed on Windows:** containers need WSL, and the stack is heavy for an 8 GB machine. A Linux cloud dev box or a Mac
  makes end-to-end testing much faster.
- **Rights:** no TV, celebrity or other people's trend formats; samples made with Hyped itself.

## Decisions for Taibanaz

**Direction, 27 October 2026 (Taibanaz):** build Hyped to Cardboard's level, landing page included, and everything in
Syed's plan. Done so far:
- **Decision 4 taken:** the prompt box ships now. The homepage hero is a Cardboard-style prompt box: link + words +
  recipe menu + clip upload, with "Auto" picking a recipe from keywords (`web/lib/prompt.ts`). A model call can replace it later.
- **Decision 10 changed:** the landing refresh grew into this Cardboard-style hero. It goes out with Recipes M1.

The others are still open; recommendation first in each.

1. **Positioning:** "every video about your product, for builders" (recommended), or a general AI editor head-on with Cardboard.
2. **Order:** Recipes v1 and uploads first (recommended: visible soon, reuses today's pipeline), or the editor first.
3. **After Recipes:** the editor (layouts, several clips) before Premium (recommended: unlocks 3 of the first 10 recipes), or
   Premium first (Syed's order: earns money sooner).
4. **One prompt box:** with Recipes in Phase 1 (recommended), or last (Syed's order).
5. **Edit model v2:** design it now and build it in Phase 2 (recommended), or keep extending the reel model.
6. **Generated footage:** yes, in Premium on credits with a cost preview (recommended), or not this quarter.
7. **Developers:** public API next, then MCP and plugins (recommended), or after Premium.
8. **Pricing:** keep pay-once credits and add Premium credits (recommended), or move to monthly plans like Cardboard.
9. **Dev machine:** get a Linux cloud dev box or a Mac for full-stack testing (recommended), or keep WSL on the current PC.
10. **Landing refresh:** open the PR now (recommended), or change the design first.

## Sources

- Cardboard: [home and pricing](https://cardboard.ai), [recipes](https://cardboard.ai/recipes), [changelog](https://cardboard.ai/changelog);
  YC W26 and funding: [everydev.ai](https://www.everydev.ai/developers/cardboard-inc), [vcbacked.co](https://www.vcbacked.co/company/cardboard-san-francisco).
- HeyGen website-to-video: [July 2026 release](https://www.heygen.com/blog/heygen-july-2026-release).
- Generated video prices (third-party, they disagree; check official pages): [invideo.io](https://invideo.io/blog/ai-video-model-pricing),
  [atlascloud.ai](https://www.atlascloud.ai/blog/cheapest-ai-video-generation-api-2026), [coverr.co](https://coverr.co/blog/ai-video-generation-api-pricing-2026).
- Hyped: `docs/STRATEGY.md`, `docs/ARCHITECTURE.md`, `docs/UNIT_ECONOMICS.md`, Syed's plan PDF (Slack, 26 Oct 2026), and the code.
