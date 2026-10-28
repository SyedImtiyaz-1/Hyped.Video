# Recipes: the detailed plan

Draft for review, 27 October 2026. It details step 1 of [ROADMAP.md](ROADMAP.md) and step 2 of Syed's plan ("write the
Recipes plan in detail: data model, gallery page, input forms, the first 10 recipes"). Syed's plan says this replaces
the Template Categories plan, which isn't in the repo. File paths are on `launch/caption-styles`.

## In one minute

- **A recipe is a template that knows what it needs.** Today's `Template` (story beats, tone, music, voice) gains a
  category, a tier, a sample video, an input form (files and text fields) and a kind: a product video (the agent) or a
  reel (the reel editor). The 10 templates become the first 10 live recipes on day one, with the same ids, so old jobs,
  links and the new hero chips keep working.
- **Several uploads per video.** The reel upload system is widened from videos to photos and audio. Uploaded files
  reach the container as `/workspace/assets/…`, and the agent gets a list of them with what each one is for.
- **A gallery** at `/recipes` (public) and `/dashboard/recipes`, by category, with samples that play on hover. Each
  recipe opens one panel: sample on the left; pitch, inputs, "Anything to change?", shape, cost and Remix on the right.
- **Syed's first 10 recipes ship in three waves:**
  - **Wave 1:** 3 ship with the gallery (Browser Launch, Serif Story, Podcast Clip).
  - **Wave 2:** 3 need the new uploads (Founder Launch Film, App Walkthrough, Screen Product Demo).
  - **Wave 3:** 4 wait for the editor's layouts, several clips or photo cut-outs (Split-screen Talking-head, Redline Vlog, Event Recap, Spec Sheet Showcase).
- **Size:** M–L overall. Milestone 1 (gallery from today's templates) is S.

## How it works today

| Piece | Where | What it does |
|---|---|---|
| Templates | `packages/core/src/templates.ts` | 10 `Template`s: id, name, use, goal, platforms, videoType, length, format, tone, music, voice, beats, rules |
| Gallery | `web/components/templates/template-gallery.tsx`, `/templates`, `/dashboard/templates` | Cards filterable by goal; each links to `/dashboard/new?template=…` |
| New-video form | `web/app/dashboard/new/new-video-form.tsx` (832 lines) | 5 steps (Product, Story, Look, Sound, Review), prefilled from the template |
| Job API | `web/app/api/jobs/route.ts` | Validates, pre-flights the site or repo, spends credits (`creditsFor`: length × tier), stores `Job.template` |
| Agent brief | `runner/src/agent.ts` `templateBrief()` | Sends the beats, scaled to the chosen length, plus the template's rules |
| Uploads | `/api/reels/uploads` (+ `/part`, `/complete`), `web/lib/reel-uploads.ts` | Multipart to R2 `uploads/<user>/…`; videos only (MP4, MOV, WebM), up to 4 GB, 8 MB parts |
| Reels | `packages/core/src/reel.ts`, `edit-styles.ts` | One clip per reel (`Job.reel.key`); 6 edit styles (Creator, Clean, Podcast, Hype, Cinematic, Behind you) |
| Samples | `web/lib/showcase.ts` | 9 finished videos on `media.hyped.video`, covering 8 of the 10 templates (not Social Proof or README Loop) |

## Data model

### The recipe (new `packages/core/src/recipes.ts`)

```ts
export type RecipeKind = "video" | "reel"; // the agent's pipeline, or the reel editor's
export type RecipeCategory = "launch" | "product" | "talking-head" | "vlog" | "clipping" | "aftermovie" | "updates" | "ads" | "dev";
export type AssetKind = "image" | "video" | "audio";
export type AssetRole =
  | "founder" | "product" | "screenshot" | "screen-recording" | "face-cam"
  | "speaker" | "clip" | "reaction" | "logo";

export type RecipeInput =
  | { id: string; type: "source"; label: string; accept: ("website" | "github")[]; optional?: boolean }
  | { id: string; type: "files"; label: string; hint?: string; accept: AssetKind[]; role: AssetRole; min: number; max: number }
  | { id: string; type: "text"; label: string; placeholder?: string; max: number; optional?: boolean; multiline?: boolean };

export type Recipe = {
  id: string;                    // stable: stored on Job.template, used in URLs
  name: string;
  pitch: string;                 // one line: "Turn your founder story into a narrated 40-second launch film"
  category: RecipeCategory;
  kind: RecipeKind;
  tier: Quality;                 // "works best with": standard | studio
  format: Format;                // the default shape
  formats: Format[];             // shapes it allows
  durationSec: number;           // default length
  durations: [min: number, max: number];
  platforms: string[];
  inputs: RecipeInput[];         // the form, in order
  status: "live" | "soon";       // its sample video comes from web/lib/showcase.ts (showcaseFor), not from here
  video?: { videoType: VideoType; tone: string; music: MusicChoice; voice: VoiceId | null; beats: TemplateBeat[]; rules?: string[] };
  reel?: { editStyle: ReelEditStyle; overrides?: Partial<ReelOptions> };
};
```

- **The 10 templates become recipes** with `kind: "video"`, `inputs: [source]`, their own `video` block, `status: "live"`.
  `templateById` stays as a thin alias, so `Job.template`, `templateBrief()` and `/dashboard/new?template=` work
  unchanged. A test checks that each migrated recipe produces the same agent brief as its template did.
- **Categories:** today's goals map over (launch → launch, update → updates, ads → ads, explain → product,
  dev → dev); talking-head, vlog, clipping and aftermovie are new, for reels and uploads.
- **One validator for both sides:** `validateRecipeInputs(recipe, { source, fields, assets })` in core returns the first
  problem in plain words ("Add at least 3 photos"). The panel uses it as you type; the API uses it before spending credits.

### What a job stores

- `Job.template` keeps the recipe id (the ids don't change, so no data migration).
- **New** `Job.inputs Json?`: `{ fields: Record<string, string>, assets: JobAsset[] }`.
- **New** `SourceType.UPLOADS`: for recipes with no website or repo (App Walkthrough from screenshots).
  `Job.sourceUrl` then holds the first file's name, as reels already do.
- Schema changes go through `npm run db:push` locally; Syed runs `npm run prod:db`.

```ts
export type JobAsset = {
  key: string;        // R2: uploads/<user>/<uuid>.<ext>
  input: string;      // which RecipeInput it answers
  kind: AssetKind;
  role: AssetRole;
  name: string;       // the file's own name, shown back to the customer
  bytes: number;
  width?: number; height?: number; durationSec?: number;
};
```

### The contract with the container (`packages/core/src/contract.ts`)

- `BragRequest.source.type` gains `"NONE"`.
- `BragRequest` gains `fields?: Record<string, string>` and `assets?: { path: string; kind: AssetKind; role: AssetRole; label: string; name: string }[]`.
- **Render Worker** (`render/src/index.ts`): before starting the runner, copies each asset from R2 to
  `/workspace/assets/<input>-<n>.<ext>`, the way it already copies a reel's upload to `/workspace/input.*`.
- **Runner** (`runner/src/agent.ts`):
  - `prepareWorkspace` scales photos down to 2048 px on the long side (ffmpeg is in the image) and copies them into the
    project, so `workspace.tgz` carries them to revisions and the agent spends fewer tokens looking at them.
  - Clips stay in `/workspace/assets` and come back from R2 for a revision while the upload is kept.
  - New `fieldsBrief()` and `assetsBrief()` sit next to `templateBrief()`. They list each text field and each file with
    its role ("assets/founder-1.jpg: the founder's portrait").
  - Each recipe's `rules` say how to use them ("Open on the founder portrait; show product photos full-bleed with slow push-ins").

### Uploads

- `/api/reels/uploads` becomes `/api/uploads`, with the old path kept as an alias. It accepts:

  | Kind | Types | Up to |
  |---|---|---|
  | Video | MP4, MOV, WebM | 4 GB (as today) |
  | Image | JPEG, PNG, WebP | 20 MB each |
  | Audio | MP3, M4A, WAV | 200 MB |

  SVG and HEIC are refused with a plain message: SVG can carry script, and HEIC doesn't open in Chromium.
- Small files go up as a single part through the same multipart calls, so the client code stays one path.
- **Retention:** uploads already expire after `REEL_EDIT_DAYS` (7) under the bucket's `uploads/` lifecycle rule. Photos also
  live on in `workspace.tgz`, so revisions keep working after that.
- **Cost:** a photo costs the agent about 1.5k tokens to look at (UNIT_ECONOMICS), mostly cache reads after the first
  look. Even 20 photos add only a few cents. Measure Founder Launch Film with 20 photos before launch.

## Gallery page

- **Routes:**
  - `/recipes` (public, indexed) and `/dashboard/recipes`. `/templates` and `/dashboard/templates` redirect there (308).
  - A page per recipe at `/recipes/[id]`: shareable, good for search, and the target of the landing page's chips and cards.
- **Top:** "What are we making today?" with a search box and category chips: All, Launch, Product, Talking-head, Vlog,
  Clipping, Updates, Ads, Developers.
- **Body:** one grid, live recipes first, with **Start from scratch** (today's 5-step form) as a strip above it. Once
  every category has at least 4 recipes, it becomes a row per category that scrolls sideways, like Cardboard's (built:
  `ROW_MIN` in `recipe-gallery.tsx`). With 1–3 recipes a category, rows left empty space on the right.
- **Soon (27 Oct):** Browser Launch and Serif Story show as Soon, so the grid of 12 has no gaps at 2 or 3 columns.
- **Card:**
  - The sample's poster; it plays muted on hover (`ExampleVideo`) and opens with sound on click.
  - Name, pitch, then chips: shape · length, the tier badge (Standard or Studio), and "Uses your photos" or
    "Uses your clips" when it takes files.
  - A recipe with no sample yet shows a designed placeholder: its beats as a storyboard, as template cards do today.
- **"Soon" recipes** show a Soon badge and no Remix. We show 2–3 at most, so the gallery never looks unfinished.
- **Empty search:** "No recipe for that yet. Start from scratch, or describe it and we'll pick one" (the prompt box, later).

## The recipe panel (input form)

Opens over the gallery on desktop and as its own page on phones. It's one screen, not five steps:

- **Left:** the sample video, with play controls.
- **Right, top to bottom:**
  1. **Name and pitch.** "Works best with **Studio**" (or Standard). A Studio recipe on a Standard balance shows the credit difference.
  2. **The inputs, in the recipe's order:**
     - **Source:** today's URL or repo field, with the same pre-flight check and private-repo token.
     - **Files:**
       - A drop zone that says what it wants ("Founder and product shots · 3–20 photos").
       - Thumbnails that can be reordered and removed, with upload progress and `min`/`max` checked as files land.
       - Uploads start the moment files drop, so Remix doesn't wait on them.
     - **Text:** short fields with a character count ("Founder and company", "Tagline").
  3. **Anything to change?** (optional): becomes `Job.notes`, as the notes field does today.
  4. **Shape and length:** chips limited to the recipe's `formats` and `durations`.
  5. **More options** (collapsed): voice, music, tone, captions, from the 5-step form's own controls.
  6. **Footer:** the cost ("2 credits · you have 13") and **Remix**. When the balance is short it says **Buy credits** instead.
- **Submit:**
  - Video recipes post to `/api/jobs` with `template`, `fields` and `assets`.
  - Reel recipes post to `/api/reels` with the recipe's edit style.
  - Both run `validateRecipeInputs` and check that every asset key is the customer's (`ownsUploadKey`) and finished uploading.
- **Signed out:** the marketing panel keeps the chosen recipe and files through sign-up, as `savePendingClip` does for
  reels today, and reopens the panel afterwards.
- **Pricing:** unchanged. `creditsFor(length, tier)`: Standard 1 / 2 / 3 credits for up to 30 / 60 / 90 s, Studio 3×.
  Recipes don't add their own surcharge in v1.

## The first 10 recipes

Syed's list, with what each needs from us and the wave it can ship in.

| # | Recipe | Kind · tier | Shape · length | Customer gives | Builds on | Needs first | Wave |
|---|---|---|---|---|---|---|---|
| 1 | **Browser Launch** | video · Standard | 16:9 · 15 s | Brand name, web address, 2–3 tagline beats; 0–2 reaction clips (later) | Agent, fully designed scenes | Text fields only | 1 |
| 2 | **Serif Story** | reel · Standard | 9:16 · 15–60 s | A speaker clip | Reels; new "serif" edit style (serif font, one word at a time, the `reveal` animation) | A new edit style | 1 |
| 3 | **Podcast Clip** | reel · Standard | 9:16 · 30–60 s | A long video (up to 20 min) | Reels' Podcast style; new moment picker; number call-outs later | Moment picker | 1 |
| 4 | **Founder Launch Film** | video · Studio | 16:9 · 40 s | 3–20 founder and product photos; founder and company; story (optional); website (optional) | Agent + several uploads | Uploads; Studio live | 2 |
| 5 | **App Walkthrough** | video · Standard | 9:16 · 20–30 s | 3–10 app screenshots or a screen recording; app name; 3 features | Agent + several uploads, no website | Uploads; `UPLOADS` source | 2 |
| 6 | **Screen Product Demo** | video · Standard | 16:9 · 30–60 s | Website or repo; optional screen recording; optional face-cam clip | Today's product video + uploads; face cam in a corner later | Uploads (face cam: layouts) | 2 |
| 7 | **Split-screen Talking-head** | reel · Standard | 9:16 · 15–60 s | A speaker clip, plus product photos or a clip | Reels + a split layout | Edit model v2 layouts | 3 |
| 8 | **Redline Vlog** | reel · Standard | 9:16 · 30 s | 1–8 clips | Reels: red key words, quick cuts, a breakbeat track | Several clips on one timeline; the track | 3 |
| 9 | **Event Recap** | video · Studio | 16:9 or 9:16 · 30–45 s | 10–40 clips and photos; event name; date | Several uploads + a montage cut | Uploads; montage cut; Studio | 3 |
| 10 | **Spec Sheet Showcase** | video · Studio | 16:9 or 1:1 · 15 s | 3–8 product photos; product name; 3 specs | Agent + photo cut-outs | Background removal for objects | 3 |

Notes per wave:

- **Wave 1, with the gallery:**
  - **Browser Launch** needs only text fields. Its rules: a misspelled or half-typed web address resolves into the brand reveal; the scenes are designed, not screenshots.
  - **Serif Story** is a seventh edit style built from pieces we already have: the minimal caption style, a serif font (DM Serif or Instrument Serif), one word at a time with the `reveal` animation. The Cinematic edit style is close.
  - **Podcast Clip's** moment picker reads the transcript we already make. A cheap model call picks the best 30–60 s, the customer can move the window, then the Podcast style runs on that range.
- **Wave 2, with uploads:**
  - **Founder Launch Film** is Studio in Syed's plan, and Studio is still "coming soon". Either it waits for Studio, or it runs on Standard until then (a decision below).
  - **App Walkthrough** is our first video with no website: screenshots become the scenes.
  - **Screen Product Demo** uses the screen recording as material in v1. The face cam in a corner comes with layouts (Wave 3).
- **Wave 3, after the editor:**
  - **Split-screen** and **Redline Vlog** need the edit model v2's layouts and several clips.
  - **Event Recap** also needs a montage cut: pick moments across many clips, to the beat.
  - **Spec Sheet Showcase** needs product cut-outs. The MediaPipe segmenter in the image is for people only. Object background removal is a new model in the container, so measure image size and speed first.

Every recipe needs its own sample video, made with Hyped itself (Syed's next step 3), added to `SHOWCASE` with its recipe id.

## Milestones

1. **M1 (S, 2–3 days): the gallery from today's templates.** Built 27 Oct (uncommitted): pages load in demo mode and
   type-checks pass; a real Remix still needs a run on the full stack.
   - `recipes.ts` with the 10 templates migrated, plus the same-brief test.
   - `/recipes`, `/recipes/[id]`, `/dashboard/recipes` and redirects from the template pages.
   - The panel with the source field, "Anything to change?", shape and length, more options, cost and Remix.
   - The landing page's chips and template cards point at recipes.
2. **M2 (M, about a week): text fields and Wave 1.** `fields` through the API, contract and runner (`fieldsBrief`); Browser Launch,
   Serif Story, Podcast Clip with the moment picker; samples for all three.
3. **M3 (M, 1–2 weeks): several uploads and Wave 2.**
   - `/api/uploads` for photos and audio, and the files field in the panel.
   - `Job.inputs` and `SourceType.UPLOADS`; asset copying in the render Worker; `assetsBrief` and photo scaling in the runner.
   - Founder Launch Film, App Walkthrough, Screen Product Demo, each measured once with `npm run measure` before launch.
4. **M4 (after the editor, Phase 2 of the roadmap): Wave 3.**
5. **Later: the prompt box.** One field that takes a link, files and words. A small model call returns a recipe id and
   prefilled inputs, and the panel opens for the customer to confirm. Everything above is the data it needs.

## Testing

- **Unit (core):**
  - Each migrated recipe gives the same agent brief as its template did.
  - `validateRecipeInputs`: missing source, too few or too many files, wrong kinds, text over the limit.
  - Upload type and size limits.
- **API:** someone else's asset key is refused; an unfinished upload is refused; a Standard balance can't buy a Studio recipe.
- **End to end, locally:**
  - One video per Wave 1 and Wave 2 recipe through `npm run dev:all`. `npm run measure` gets a `--recipe` flag, with
    files passed as paths, for cost.
  - One reel per reel recipe.
- **Type-check** `web/`, `render/`, `runner/`.

## Decisions for Taibanaz

**Decided 27 October 2026: all seven as recommended** (the first option in each). Milestone M1 started on
`launch/landing-refresh`.

1. **URLs:** `/recipes` replaces `/templates`, with redirects (recommended), or keep "Templates" as the name.
2. **Founder Launch Film before Studio ships:** run it on Standard until Studio is live (recommended), or hold it for Studio.
3. **Soon recipes in the gallery:** show 2–3 with a Soon badge (recommended), or only live ones.
4. **Start from scratch:** keep today's 5-step form as the first card (recommended), or retire it.
5. **Upload retention:** keep 7 days, since photos live on in the workspace (recommended), or 30 days for clip-based recipes.
6. **Wave 1 order:** Browser Launch, Serif Story, then Podcast Clip (recommended), or another order.
7. **Pricing:** no recipe surcharge in v1 (recommended), or extra credits for heavy recipes (Event Recap, 20-photo films).
