// Recipes: proven video formats anyone can make their own version of (docs/RECIPES.md). A recipe is a template that
// knows what it needs: which pipeline makes it (the agent's product video or the reel editor), its tier, the shapes and
// lengths it allows, and the inputs its form asks for. The 10 templates are the first 10 recipes, with the same ids, so
// Job.template, old links and the agent's brief (templateBrief in runner/src/agent.ts) don't change.
import type { MusicChoice, Quality, VideoType } from "./contract";
import { EDIT_STYLES, REEL_EDIT_STYLES, type ReelEditStyle } from "./edit-styles";
import { REEL_MAX_SECONDS } from "./reel";
import { TEMPLATES, type Template, type TemplateBeat, type TemplateGoal } from "./templates";
import type { VoiceId } from "./voices";

/** Which pipeline makes it: a product video by the agent, or a reel from the customer's own clip. */
export type RecipeKind = "video" | "reel";

export type RecipeCategory = "launch" | "product" | "talking-head" | "vlog" | "clipping" | "aftermovie" | "updates" | "ads" | "dev";

/** The gallery's categories, in its order. */
export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string }[] = [
  { value: "launch", label: "Launch" },
  { value: "product", label: "Product" },
  { value: "talking-head", label: "Talking-head" },
  { value: "vlog", label: "Vlog" },
  { value: "clipping", label: "Clipping" },
  { value: "aftermovie", label: "Aftermovie" },
  { value: "updates", label: "Updates" },
  { value: "ads", label: "Ads" },
  { value: "dev", label: "Developers" },
];

export type RecipeFormat = Template["format"];

/** What an uploaded file is, and what it's for in the video. */
export type AssetKind = "image" | "video" | "audio";
export type AssetRole = "founder" | "product" | "screenshot" | "screen-recording" | "face-cam" | "speaker" | "clip" | "reaction" | "logo";

/** One field of a recipe's form: the website or repo, files to upload, or a short text. */
export type RecipeInput =
  | { id: string; type: "source"; label: string; accept: ("website" | "github")[]; optional?: boolean }
  | { id: string; type: "files"; label: string; hint?: string; accept: AssetKind[]; role: AssetRole; min: number; max: number }
  | { id: string; type: "text"; label: string; placeholder?: string; max: number; optional?: boolean; multiline?: boolean };

export type Recipe = {
  /** Stable: stored on Job.template and used in URLs. */
  id: string;
  name: string;
  /** One line: what you get. */
  pitch: string;
  category: RecipeCategory;
  kind: RecipeKind;
  /** The tier it works best with. */
  tier: Quality;
  format: RecipeFormat;
  formats: RecipeFormat[];
  durationSec: number;
  /** Shortest and longest length it allows, in seconds. */
  durations: [number, number];
  /** Where it's made to be posted. */
  platforms: string[];
  /** The form, in order. */
  inputs: RecipeInput[];
  /** "soon" shows in the gallery without Remix. Its sample video comes from web/lib/showcase.ts. */
  status: "live" | "soon";
  /** Product videos: the agent's story, as templates carry it. */
  video?: { videoType: VideoType; tone: string; music: MusicChoice; voice: VoiceId | null; beats: TemplateBeat[]; rules?: string[] };
  /** Reels: the edit style the reel starts from. */
  reel?: { editStyle: ReelEditStyle };
};

// Today's template goals, as gallery categories.
const CATEGORY: Record<TemplateGoal, RecipeCategory> = { launch: "launch", update: "updates", ads: "ads", explain: "product", dev: "dev" };

/** Every product video starts from a website or a repo. */
const SOURCE: RecipeInput = { id: "source", type: "source", label: "Your website or GitHub repo", accept: ["website", "github"] };

/** A template as a recipe: a Standard product video from a website or repo, in any shape, 15 to 90 seconds. */
function fromTemplate(t: Template): Recipe {
  return {
    id: t.id,
    name: t.name,
    pitch: t.use,
    category: CATEGORY[t.goal],
    kind: "video",
    tier: "standard",
    format: t.format,
    formats: ["landscape", "vertical", "square"],
    durationSec: t.durationSec,
    durations: [15, 90],
    platforms: t.platforms,
    inputs: [SOURCE],
    status: "live",
    video: { videoType: t.videoType, tone: t.tone, music: t.music, voice: t.voice, beats: t.beats, rules: t.rules },
  };
}

// Next from Syed's first 10 (docs/RECIPES.md, Wave 1), shown as Soon: no Remix until their inputs and styles ship.
const SOON: Recipe[] = [
  {
    id: "browser-launch",
    name: "Browser Launch",
    pitch: "A web address typed with a typo, fixed, then your brand's reveal",
    category: "launch",
    kind: "video",
    tier: "standard",
    format: "landscape",
    formats: ["landscape", "square"],
    durationSec: 15,
    durations: [15, 20],
    platforms: ["X", "Product Hunt", "LinkedIn"],
    inputs: [
      { id: "brand", type: "text", label: "Brand name", max: 40 },
      { id: "address", type: "text", label: "Web address", placeholder: "acme.com", max: 80 },
      { id: "tagline", type: "text", label: "Tagline, in two or three beats", placeholder: "Fast. Private. Yours.", max: 120 },
    ],
    status: "soon",
    video: {
      videoType: "launch",
      tone: "polished",
      music: "upbeat",
      voice: null,
      beats: [
        { from: 0, to: 4, label: "Typing", text: "A browser's address bar: the web address is typed out, with one small typo." },
        { from: 4, to: 7, label: "Fix", text: "The typo is fixed and the page starts to load." },
        { from: 7, to: 12, label: "Reveal", text: "The brand reveal, then the tagline, one beat at a time." },
        { from: 12, to: 15, label: "Go", text: "The web address, big, as the call to action." },
      ],
      rules: ["Draw every scene (the browser, the typing, the reveal) in the brand's own colours and fonts; no screenshots."],
    },
  },
  {
    id: "serif-story",
    name: "Serif Story",
    pitch: "Elegant serif words that appear as you say them",
    category: "talking-head",
    kind: "reel",
    tier: "standard",
    format: "vertical",
    formats: ["vertical"],
    durationSec: 30,
    durations: [15, 60],
    platforms: ["Reels & Shorts", "TikTok", "LinkedIn"],
    inputs: [{ id: "speaker", type: "files", label: "Your speaker clip", accept: ["video"], role: "speaker", min: 1, max: 1 }],
    status: "soon",
    reel: { editStyle: "cinematic" },
  },
];

/** The public site's recipes: product videos, and the reels coming soon. */
export const RECIPES: readonly Recipe[] = [...TEMPLATES.map(fromTemplate), ...SOON];

/** The recipes people can make today. */
export const LIVE_RECIPES: readonly Recipe[] = RECIPES.filter((r) => r.status === "live");

// Where each edit style sits in the dashboard's gallery, among the product videos' categories.
const REEL_CATEGORY: Record<ReelEditStyle, RecipeCategory> = { creator: "talking-head", clean: "talking-head", behind: "talking-head", podcast: "clipping", hype: "vlog", cinematic: "vlog" };

/**
 * The reel edit styles as recipes, for the dashboard only: each makes a reel from the customer's own clip in that style
 * (its captions, extras, grade and music), at the clip's own shape and length. The public site's recipe pages are about
 * videos made from a product, so they leave these out.
 */
export const REEL_RECIPES: readonly Recipe[] = REEL_EDIT_STYLES.map((style) => ({
  id: `reel-${style}`,
  name: EDIT_STYLES[style].label,
  pitch: EDIT_STYLES[style].hint,
  category: REEL_CATEGORY[style],
  kind: "reel",
  tier: "standard",
  format: "vertical",
  formats: ["vertical", "landscape", "square"],
  durationSec: 30,
  durations: [1, REEL_MAX_SECONDS],
  platforms: ["TikTok", "Reels & Shorts", "LinkedIn"],
  inputs: [{ id: "clip", type: "files", label: "Your clip", hint: "A video you recorded: talking to camera works best", accept: ["video"], role: "speaker", min: 1, max: 1 }],
  status: "live",
  reel: { editStyle: style },
}));

/** Everything the dashboard's gallery shows: the recipes, then the reel styles. */
export const ALL_RECIPES: readonly Recipe[] = [...RECIPES, ...REEL_RECIPES];

/** Any recipe by id, the dashboard's reel styles included. */
export const recipeById = (id?: string | null): Recipe | null => ALL_RECIPES.find((r) => r.id === id) ?? null;

/** The categories that have at least one recipe, in the gallery's order. */
export const usedRecipeCategories = (recipes: readonly Recipe[] = RECIPES) => RECIPE_CATEGORIES.filter((c) => recipes.some((r) => r.category === c.value));
