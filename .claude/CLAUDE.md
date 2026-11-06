# Hyped: notes for Claude

Hyped (hyped.video) turns a product's website or GitHub repo into a launch video, and edits clips people record into
reels (captions, cuts, B-roll, music, Ask AI). Read first: `README.md`, `docs/ARCHITECTURE.md`, `LOCAL_TESTING.md`,
then `docs/STRATEGY.md`, `docs/PLAN.md`, `docs/UNIT_ECONOMICS.md`.

## Who decides
- Taibanaz Khan leads the project and takes the product decisions. Research and recommend; hand over clear decisions.
- Syed Imtiyaz Ali (founder) built most of it, reviews pull requests and deploys.

## Rules
- Branch, then open a pull request to `main`. Don't push to `main`, don't deploy: Syed deploys.
- Since 3 Nov 2026 the newest code is on `main` (PR #16 merged into it directly); `launch/caption-styles` is behind it.
  Branch new work from `main` unless Syed brings `launch/caption-styles` level again.
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
- Next (Syed, Slack, 4 Nov): "Skills"; he's finishing a document on it, and Taibanaz researches it first. She owns the
  product from here ("think like a product owner") while he's busier.
- Merged into `launch/caption-styles` (27–28 Oct): PR #6 `launch/landing-refresh` (below), PR #7 `fix/media-r2-errors`
  (serveFile logs R2's error and returns 503 instead of Cloudflare 1101) and PR #9 `launch/dashboard-templates` (below).
  Then PR #10 merged `launch/caption-styles` into `main` (28 Oct): `main` has everything as of that day. New PRs still
  go to `launch/caption-styles` (Taibanaz, 29 Oct). PR #11 `fix/open-dashboard-link` (a spinner on the landing page's
  dashboard buttons; Turbopack for demo mode; the template modal on phones) merged, then PR #12 merged
  `launch/caption-styles` into `main` again (29 Oct). The 29–30 Oct work below (landing vs dashboard, Editor first part A,
  E1, the local editor, the editor's full window, the sidebar) is PR #13 (`launch/realtime-editor`), merged 2 Nov; PR #14
  merged `launch/caption-styles` into `main` the same day. The 2–3 Nov work after it (Ask AI before the clip, the
  Library and click-to-open, blank Ask AI, `/api/local/file`, the desktop app plan, the Home greeting, Settings) is
  PR #15 (3 Nov, `launch/ask-ai-settings` → `launch/caption-styles`), merged 3 Nov, then PR #17 merged
  `launch/caption-styles` into `main`; it adds `ReelAssistant.projectChat` to the render Worker, so render deploys
  with or before web.
  The 3–4 Nov work after it (the editor in Cardboard's look, Ask AI's "Worked for" steps, renaming projects with
  `Job.title`, no Revisions card on the video page: Syed asked on Slack, 3 Nov, since changes go through the editor's
  Ask AI) is PR #18 (`launch/editor-look`), merged with `main` on 5 Nov (PR #16's editor and ours together) and
  retargeted to `main`; Syed merged it into `main` on 5 Nov; it needs `npm run prod:db` for `Job.title`.
  Syed asks for PR links and the day's work in #daily-updates, as a reply in that day's bot thread (6 Nov).
- Syed's two documents (5 Nov, Slack): the agent skills research (video quality: a review gate, a second model as
  critic, a HyperFrames trial, in three waves) and the launch plan with dates (deploy by 13 Nov, Product Hunt 3 Dec).
  Taibanaz's decisions on both (6 Nov) are in `docs/ROADMAP.md`: all as recommended, except marketing: she doesn't take
  outreach or customer and beta calls (someone part-time); she approves the launch copy. Her dates: the Product Hunt
  "coming soon" page by 9 Nov (Claude drafts), the golden set rated blind with Syed on 12–13 Nov, the launch copy
  23–27 Nov, go/no-go on 30 Nov, the users' email on 1 Dec, editor part B (web side) 14 Dec – 5 Feb.
  The Product Hunt page's tagline (Taibanaz, 6 Nov): "Make a launch video from a link, or edit your own clip"; logo
  `web/public/brand/hyped-icon-240.png`. Syed, asked which account should make the page (6 Nov): "Leave this", so the
  coming-soon page is off her list for now.
- Sign-up and sign-in as Cardboard's (Taibanaz, 6 Nov; PR #19, `launch/sign-up-pages` → `main`, with her decisions
  above; open for Syed's review; screenshots sent to him on Slack with the ask to lower Clerk's 15-character
  minimum password to 8): always dark,
  the Clerk form on the left under a serif heading ("Make your first video" / "Welcome back") with the terms under it, and
  on wide screens a panel on the right with our showcase posters fanned behind a prompt box that types asks, and three
  chips (`components/auth/`: `auth-shell.tsx`, `auth-showcase.tsx`, `auth-appearance.ts` as style objects, since Clerk's
  CSS-in-JS beats Tailwind's layer). Clerk's own pages only: `signInUrl`/`signUpUrl` on ClerkProvider and
  clerkMiddleware, and the landing's Log in / Start free go to them instead of Clerk's modal. The form's fields (names,
  password, Google only as Cardboard's sign-up) are set in Clerk's dashboard, which is Syed's. No "Optional" by the name
  fields (Taibanaz, 6 Nov), Clerk's bot check ("Verify you are human") dark, a skeleton of the form while Clerk's
  script loads, and a signed-in visitor sent on (`leaveIfSignedIn`), since Clerk's forms render nothing for them.
- PR #16 `launch/templates-skills` (Syed's Mac work, 26 Oct–3 Nov; merged into `main` 3 Nov, not yet deployed): 51 caption
  templates (`packages/core/src/caption-templates.ts`, `web/components/reels/template-gallery.tsx` in the reel form and
  the editor's Style tab, chat op `caption_template`) on new caption engine features (lockup layout, align, key-word
  font/caps/colour/glow, ghost words, letter spacing, box colour, Behind-you colours and casing, 11 big-word fonts) and 12
  new OFL fonts (`runner/fonts/`, `web/components/reels/fonts/`); the effects pack (19 effects, 18 caption
  animations) and Transitions (`transitions-panel.tsx`, a timeline track); the product video editor (captions rendered
  after the agent, `Job.reel.video`, the "original" soundtrack, `/api/reels/[id]/prepare` for older videos); the 4:5
  portrait format; GitHub change videos (`packages/core/src/github.ts`, `runner/src/change.ts`); App Store / Play Store
  preview templates (goal `app`); the Hyped skills family (`runner/skills/hyped*`: core references and formats, launch /
  update / ads / explain / dev / release / app scenarios, the `hyped-review` critic), routed in `runner/src/agent.ts`
  behind `HYPED_SKILLS=1` (off: brag-slim stays in production until an A/B is measured); `docs/EDITOR_REDESIGN_PROMPT.md`.
  Merged with Taibanaz's editor the same day: her layout is the base, his features sit inside it. Deploying it needs a
  new render container image (fonts, skills) on a Cloudflare account with Workers Paid, render before web.
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
  reels in one grid at `/dashboard/videos`), Templates, with credits, Usage, Settings and help at its foot, and New
  project at its top under search, as Cardboard's app has it (Taibanaz, 2 Nov; no longer in the top bar or the
  Projects page's header); a click lights its link at once, with a spinner until the page is in; on the home, the
  lit link follows the scroll as Cardboard's does (Templates or Projects, by the open tab, once the lower card is
  reached or the page's foot; `components/shell/home-section.ts`), and the other way Home, Templates and Projects
  clicked there scroll to their part (the card on that tab; its "View all" opens the pages); the highlight slides from
  link to link, a shade stronger while it moves (Taibanaz, 2 Nov); the
  dashboard is dark until the customer picks a theme; a template opens in a modal over the page
  (`web/components/recipes/recipe-modal.tsx`, `?recipe=` in the address), and its page stays for links; the strip's
  first tile is "Upload a clip" (to the reel form) until "make it like this" exists.
- Reel templates (29 Oct, in PR #13): the six reel edit styles are templates in the dashboard (`REEL_RECIPES`,
  ids `reel-<style>`, in `packages/core/src/recipes.ts`), not on the public site. Decisions (Taibanaz, 29 Oct): they sit
  in the categories with the videos, as on Cardboard (Talking-head, Vlog, Clipping), and their popup starts the reel
  itself: the clip, "Anything to change?" (saved as `Job.notes`, then waiting in the editor's Ask AI) and Remix.
  The upload logic is shared with the reel form (`web/components/reels/use-reel-upload.ts`). Tiles carry no text
  (no "Reel" badge or feature chips; the name on hover); real sample reels per style are still to make (they need our
  own clips and Syed's full stack; one `SHOWCASE` line each, with `template: "reel-<style>"`).
- Landing and dashboard, told apart as Cardboard's are (Taibanaz, 29 Oct, in PR #13): the dashboard is a clean
  workspace (prompt box, category chips that open their templates, then Templates | Your projects; the "Remix a
  video" strip plays by itself), with no floating videos; the greeting is back since 3 Nov (Taibanaz, as Cardboard's:
  "What video are we making today, <first name>?" in the serif over the prompt box, the name from Clerk). Settings
  (Taibanaz, 3 Nov): the parts Cardboard's account settings have (its help docs: Profile, Security, Subscription,
  Preferences), no Connectors, Brand kit or Developers: its own menu on the left, that part's cards on the right,
  `?tab=` in the address (`app/dashboard/settings/settings-view.tsx`). Profile: display name (saved on Clerk; Home
  greets by its first word), picture, email, deletion by email. Security: Clerk's profile (password, sign-in accounts,
  devices), log out. Plan & billing: plan, credits, Buy credits, Credit history. Preferences (in this browser,
  `lib/prefs.ts`): theme, the default voiceover a new video starts with, snap to the playhead on the timeline, and
  export quality as it is (1080p, 30 fps, MP4). Projects can be renamed (Taibanaz, 3 Nov, as Cardboard's): a click on
  the name in the editor's bar (`components/shell/project-title.tsx`) saves `Job.title` (a new column: PATCH
  `/api/jobs/[id]`, an empty name going back to the source's), and `projectName()` (`lib/project-name.ts`) names a
  project everywhere (editor, video page, Projects grid, lists, search). Syed runs `npm run prod:db` before it goes live. The landing page follows Cardboard's flow in our
  own words: hero (a serif headline that cycles "Make a launch video / from your website" and so on, prompt box,
  floating samples), Made with Hyped (masonry), Three steps (paste, direct, share), Everything a video needs (01 story,
  02 edit, 03 publish), use-case tabs, pricing, FAQ. What we don't have yet (videos from words alone, a Mac app,
  Claude/ChatGPT plugins) stays off it.
- Editor first (Taibanaz, 29 Oct; roadmap Decision 2), in two parts. Part A (in PR #13): the dashboard's prompt
  box starts at once and opens the editor (`/dashboard/videos/[id]/edit`) on its first cut, as Cardboard's does (a link
  starts the video with Auto's recipe, a clip uploads and starts a reel; the line under the box says Enter spends credits
  and confirms ownership); template Remix opens the editor too. The editor has Cardboard's layout (tools rail and panel,
  preview, Ask AI always open, timeline; "Filters" is "Looks") and an export dialog (1080p, 30 fps, MP4 and the
  watermark as they are; 4K, 60 fps, MOV and WebM shown locked). Product videos open in the same frame with Ask AI
  sending revisions, until Syed's product video editor lands. Part B, with Syed (render pipeline, full stack): layout
  presets (several clips: edit model v2), about 20 looks, the Director as an agent that asks for what's missing, 4K/60 fps.
- The real-time editor, step E1 (Taibanaz, 30 Oct; in PR #13): an interactive timeline on today's edit model,
  no render change (`web/components/reels/reel-timeline.tsx`): drag B-roll, effects, sounds and cuts, drag their edges to
  resize, drag across the Video track to cut a stretch out, Delete removes the picked piece, Space plays, the arrows step;
  a drag is one undo step and snaps to the playhead. E2–E6 (several clips, layouts, looks and titles, the Director agent,
  4K) need Syed; a spec for him (`docs/EDITOR.md`) waits until E1 has been tried. The customer's own clip opens in the
  editor at once, from their computer (`/dashboard/edit/local`, the editor's `local` mode, a blank edit): in demo mode
  the prompt box hands clips there in memory; its captions follow in seconds (Taibanaz, 30 Oct): the browser sends the
  sound as 16 kHz WAV to `/api/local/transcribe` (local development only, whisper-1 with the root .env's OpenAI key,
  as the pipeline does). Ask AI works on it too in local development (Taibanaz, 2 Nov): `/api/local/chat` makes the
  render Worker's ReelAssistant call itself (the plan's small model, CHAT_SYSTEM, the reel_chat schema, the root .env's
  key; the request body shared with the real route in `web/lib/chat-body.ts`), checks the changes the same way, and
  leaves out stock B-roll (searched by the render Worker). `/api/local/*` is signed-in only (middleware) and 404s in
  production. B-roll search and Export still need the clip uploaded. The editor's
  preview now has the reel's own shape (the render keeps the clip's), not always 9:16. Next: the same instant open on a
  real account, while the upload and the first cut run, then merging the two.
- Fully like Cardboard (Taibanaz, 2 Nov; in PR #13): the editor's pages (`/dashboard/videos/[id]/edit`,
  `/dashboard/edit/*`) take the whole window, without the sidebar or anything over them (a strip of open projects'
  tabs was tried, then removed the same day for a bigger preview: the bar's back button leaves the editor).
  New project (the sidebar's button, the projects grid's tile, the New project button in the editor's bar) opens an empty editor at
  `/dashboard/edit/new` ("Your timeline is empty", Import media, drop, Ctrl+I): a clip imported there goes where the
  prompt box sends one (uploaded and started; demo mode, or local development when the upload fails, opens it from
  the computer). The 5-step form (`/dashboard/new`) stays, for websites, from the phones' bottom bar and Projects' empty
  state. Ask AI works in the empty editor too, before any clip (Taibanaz, 2 Nov): it only answers what's asked and never
  acts on its own (`packages/core/src/project-chat.ts`, `/api/projects/chat`, the render Worker's
  `ReelAssistant.projectChat`, or the root .env's key in local development without the render Worker). "Pull my video
  from Downloads" (or a pasted path) opens the file window there at once, with no button (Taibanaz, 3 Nov; `pickAsked`
  spots the ask, since a browser opens the picker only inside her own Enter or click, and no web page can take a file
  from a folder without that one pick), and the Library shows the file asked for until it's chosen. The chosen clip
  shows in the Library, then the editor opens on it with its Media tab. An edit asked for before the clip is kept
  ("Waiting for your clip: …") and typed into the editor's Ask AI once the clip is in, for her to send (the reel's notes
  when uploaded). Opening a file with no pick at all takes a desktop app: decided (Taibanaz, 3 Nov), planned in
  `docs/DESKTOP_APP.md` (Electron shell around hyped.video, a read-only bridge to allowed folders; Mac first), for Syed to build.
  Until then, local development only (Taibanaz, 3 Nov): the dev server reads the video itself (`/api/local/file`: a
  pasted path, else the named or newest video in that folder, videos inside the home folder only, read-only, 404 in
  production), so it comes straight into the Library with no window; Ask AI is told it was found. A video Ask AI brings
  in waits in the Library, and a click on it opens the editor on it (Taibanaz, 3 Nov; Import media, Add and a drop
  still open at once). Ask AI is blank until the first message, its box too: no intro, suggestions or placeholder, in
  the empty editor and the editor alike, as Cardboard's (Taibanaz, 3 Nov). Each answer has "Worked for 4s ›" over it,
  as Cardboard's chat (Syed sent its look on 3 Nov: odysseyui's Thought Chain on 21st.dev); opened, the steps as a
  chain: what was asked, what it looked at (the playhead, the pick, the captions) or did (found the video, opened the
  folder, kept the edit), what it worked out. The editor's look follows Cardboard's (Taibanaz, 4 Nov, from Syed's
  screenshot of its Mac app): always dark whatever the theme (`dark` on the editor's wrapper in `app-shell.tsx`), edge
  to edge with flush parts and hairlines between them, three greys (`--color-editor-app/panel/stage/line` in
  `globals.css`), the stage a grey border round a black canvas with the video in its middle, square, nothing over it (play is in the timeline's header), as Cardboard's (Taibanaz, 4 Nov), the Video track a filmstrip of the clip with its name (frames made in the browser, `useFilmstrip`), no strip of notes for a clip not uploaded (the bar's subtitle says it), Export the light button with ⌘E, quiet track tints
  with a line of their colour, and Hyped's lime as the one accent (the playhead, the piece picked, snap when on); the
  timeline's header has the time, undo/redo and snap (magnet) on the left, back/play/forward in the middle,
  the zoom pill, Fit and full screen on the right, no hint line and no scrollbar under the tracks, a seconds ruler
  (5s, 10s) with the playhead's timecode over the track names, icons by them; play no longer sits under the video
  (full screen keeps a bar); the tools' first tab is Library (search, Add as "coming soon", tiles with their length);
  Ask AI's header names the chat (its first request), with Earlier chats (this visit's, kept by a new chat) and + (a new chat), and its show/hide button sits at the bar's right end; your messages in grey bubbles, answers as
  plain text with Copy, a tall input with a round send. While it works, one shimmering line, "Working for 12s ›", closed as
  Cardboard's (Taibanaz, 4 Nov); a click opens the same chain live: a tick for each step done, a spinner and "In
  progress" on the one under way (its title shimmering), empty rings for those to come (`chat-panel.tsx`). Only steps
  that really happen are shown. Next for Cardboard parity: Search with ⌘F, and "Home" or "Dashboard" as the first link's name (her call).
- Syed's editor spec ("Video Editor Prompt", Slack 29 Oct: a four-zone workspace, phase 1), the parts added on
  `launch/realtime-editor` (2 Nov, in PR #13): a Media tab (`media-panel.tsx`); Ask AI answers list what they
  changed with Undo this for that answer alone (`chat-steps.ts`), the box shows "At 0:12 · what's picked" and sends the
  pick to `/api/reels/[id]/chat` (`selection`, added to the context in the web route; core and render unchanged); the
  draft autosaves in the browser (`hyped:reel-draft:<job>`, back on reopen until exported) with Saved / Saving… in the
  bar; an aspect chip; the timeline zooms with a slider, Fit and ⌘/Ctrl+wheel around the pointer, its ruler adapts, and
  empty tracks hide (a toggle); keys: a frame per arrow, ↑/↓ caption lines, ⌘E, ⌘/, [ and ], F, ? for the list
  (`shortcuts-dialog.tsx`); a full-screen preview (the button under it, or F; Esc leaves); the editor fills the window and never scrolls as a page (2 Nov: the bar and the timeline
  keep their height, the panels and the preview take the rest, the preview sized to its column with container units;
  the same for the empty editor and the first cut's frame). Still to do from the spec: an editable name, play
  controls and a resizable height in the timeline's header, 120px track labels with icons, panel headers with search,
  the 1024–1279px drawer and the phone layout's bottom tab bar, screenshots at three sizes. `transitions-panel.tsx` and
  `template-gallery.tsx` arrived with PR #16 (3 Nov).

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
