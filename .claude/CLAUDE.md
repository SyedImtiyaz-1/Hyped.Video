# Hyped: notes for Claude

Hyped (hyped.video) turns a product's website or GitHub repo into a launch video, and edits clips people record into
reels (captions, cuts, B-roll, music, Ask AI). Read first: `README.md`, `docs/ARCHITECTURE.md`, `LOCAL_TESTING.md`,
then `docs/STRATEGY.md`, `docs/PLAN.md`, `docs/UNIT_ECONOMICS.md`.

## Who decides
- Taibanaz Khan leads the project and takes the product decisions. Research and recommend; hand over clear decisions.
- Syed Imtiyaz Ali (founder) built most of it, reviews pull requests and deploys.

## Rules
- Branch, then open a pull request to `main`. Don't push to `main`, don't deploy: Syed deploys.
- The newest code is on `launch/caption-styles` (what's live), not `main`. Branch new work from it.
- Test locally (`npm run dev:all`, or demo mode), never on hyped.video. Never touch production or use anyone else's login.
- Never commit or paste secrets. `.env`, `.env.*` and `.dev.vars` stay git-ignored.
- Containers stay keyless; the R2 video bucket stays private (only `serveMedia` serves files).
- Schema changes: edit `packages/core/prisma/schema.prisma`, run `npm run db:push` locally, tell Syed (`npm run prod:db`).
- Before a PR: `npx tsc --noEmit` in `web/`, `render/` and `runner/`. There is no ESLint config.
- Ask before committing, opening a PR, or anything outward-facing.

## Product direction
- The working plan is `docs/ROADMAP.md` (27 Oct 2026, draft until its decisions are taken). Update it as decisions land.
- Recipes, in detail: `docs/RECIPES.md` (data model, gallery, panel, the first 10 recipes in three waves, milestones M1–M4).
- Inspiration: cardboard.ai (recipe gallery, one prompt box, an agent-driven editor with chat and timeline, generative
  footage, 4K, CLI and MCP). Be inspired, don't copy: our own recipes and sample videos, no formats built on TV clips,
  celebrities or other people's shows.
- Syed's roadmap (26 Oct 2026): ship the product video editor → Recipes gallery + several uploads per video → Premium
  (4K, 60 fps, MOV) → pro editor tools (layouts, titles, looks, sound library) → "make it like this" + one prompt box.
- Direction (Taibanaz, 27 Oct): build Hyped to Cardboard's level, landing page included, and everything in Syed's plan.
- Merged into `launch/caption-styles` (27–28 Oct): PR #6 `launch/landing-refresh` (below), PR #7 `fix/media-r2-errors`
  (serveFile logs R2's error and returns 503 instead of Cloudflare 1101) and PR #9 `launch/dashboard-templates` (below).
  Then PR #10 merged `launch/caption-styles` into `main` (28 Oct): `main` has everything as of that day. New PRs still
  go to `launch/caption-styles` (Taibanaz, 29 Oct). Open for review: `fix/open-dashboard-link` (a spinner on the
  landing page's dashboard buttons while the dashboard loads; Turbopack for demo mode).
- PR #6, `launch/landing-refresh` (27 Oct): a Cardboard-style landing page (full-screen hero
  with a prompt box: link + words + recipe menu + clip upload, "Auto" picks a recipe in `web/lib/prompt.ts`; floating
  sample tiles; a timeline ruler; the recipes gallery right below; then the examples strip, feature bento, pricing) and Recipes M1 (`packages/core/src/recipes.ts`, `/recipes`,
  `/recipes/[id]`, `/dashboard/recipes`, the one-screen panel at `/dashboard/recipes/[id]`, 308s from the template pages).
  Type-checks pass and the pages load in demo mode; a real Remix still needs testing with the full stack.
- PR #9, `launch/dashboard-templates` (28 Oct): a Cardboard-style dashboard. The home greets by first
  name over the shared prompt box (`web/components/create/prompt-box.tsx`), then one card: Templates ("Remix a video"
  strip, then "Pick a template to remix" with search, Short/Long-form, sizes, types, a row per category) and Your
  projects (a grid), then this month's numbers. Decisions (Taibanaz, 28 Oct): the dashboard UI says "Templates", not
  "Recipes" (text only: URLs, code and the public site still say recipes); the sidebar is Home, Projects (videos and
  reels in one grid at `/dashboard/videos`), Templates, with credits, Usage, Settings and help at its foot; the
  dashboard is dark until the customer picks a theme; a template opens in a modal over the page
  (`web/components/recipes/recipe-modal.tsx`, `?recipe=` in the address), and its page stays for links; the strip's
  first tile is "Upload a clip" (to the reel form) until "make it like this" exists.

## Local development
- macOS: `npm run dev:all` (database, render Worker on 8787, site on 3001). See `LOCAL_TESTING.md`.
- Windows: Wrangler can't run containers on Windows, so the full stack runs from a clone inside WSL (Ubuntu). For UI
  work, demo mode runs on Windows directly: in `web/`, `$env:DEMO_MODE="true"; npx next dev -p 3100 --turbopack`
  (PowerShell). Without `--turbopack` (webpack), each page takes minutes to compile on a PC with 8 GB of RAM, and links
  seem dead while it does.
  `npm run demo` and the macOS key dialogs (`npm run openai-key` and others) don't work on Windows; edit `.env` by hand.

## Keep this file current
When a decision is made, a branch merges, the roadmap changes or the setup changes, update this file in the same
session. Personal notes (who uses which account, one machine's quirks) belong in Claude's own memory, not here.
