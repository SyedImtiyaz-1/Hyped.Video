// Templates: proven recipes for the videos people make most. A template fills the new-video steps (every choice stays
// editable) and hands the agent the story beat by beat. Browsing is free; a video costs the usual credits.
import type { MusicChoice, VideoType } from "./contract";
import type { VoiceId } from "./voices";

export type TemplateGoal = "launch" | "update" | "ads" | "explain" | "dev";

/** One beat of the story: seconds into the video, a short name, and what happens. */
export type TemplateBeat = { from: number; to: number; label: string; text: string };

export type Template = {
  id: string;
  name: string;
  /** What it's for, in a few words: the card's subtitle. */
  use: string;
  goal: TemplateGoal;
  /** Where it's made to be posted. */
  platforms: string[];
  videoType: VideoType;
  durationSec: number;
  format: "landscape" | "vertical" | "square";
  /** A tone from the new-video steps ("" lets the agent choose). */
  tone: string;
  music: MusicChoice;
  /** The suggested voice, or null for no voiceover. */
  voice: VoiceId | null;
  /** The story, timed for durationSec; the agent scales it when the customer picks another length. */
  beats: TemplateBeat[];
  /** Extra rules for the agent, when the recipe needs them. */
  rules?: string[];
};

export const TEMPLATE_GOALS: { value: TemplateGoal; label: string }[] = [
  { value: "launch", label: "Launch" },
  { value: "update", label: "Updates" },
  { value: "ads", label: "Ads" },
  { value: "explain", label: "Explain" },
  { value: "dev", label: "Developers" },
];

export const TEMPLATES: Template[] = [
  {
    id: "launch-day",
    name: "Launch Day",
    use: "The launch video for Product Hunt or your homepage",
    goal: "launch",
    platforms: ["Product Hunt", "Homepage", "YouTube"],
    videoType: "launch",
    durationSec: 60,
    format: "landscape",
    tone: "polished",
    music: "upbeat",
    voice: "maya",
    beats: [
      { from: 0, to: 4, label: "Hook", text: "The product's best result, shown in its real UI." },
      { from: 4, to: 12, label: "Problem", text: "The problem it solves, in one sharp line." },
      { from: 12, to: 18, label: "Meet it", text: "Name and logo, landing in its UI." },
      { from: 18, to: 48, label: "Features", text: "Three key features, one per scene, each shown working in the real UI." },
      { from: 48, to: 56, label: "Proof", text: "A number, a result or a detail people remember." },
      { from: 56, to: 60, label: "CTA", text: "Call to action with the web address." },
    ],
  },
  {
    id: "three-features",
    name: "3 Features in 30",
    use: "A quick tour for X and LinkedIn",
    goal: "launch",
    platforms: ["X", "LinkedIn"],
    videoType: "launch",
    durationSec: 30,
    format: "square",
    tone: "default",
    music: "upbeat",
    voice: "jess",
    beats: [
      { from: 0, to: 3, label: "Hook", text: "The promise in a few words." },
      { from: 3, to: 10, label: "Feature 1", text: "Feature 1 in the real UI, numbered 1." },
      { from: 10, to: 17, label: "Feature 2", text: "Feature 2, numbered 2." },
      { from: 17, to: 24, label: "Feature 3", text: "Feature 3, numbered 3." },
      { from: 24, to: 30, label: "CTA", text: "Call to action with the web address." },
    ],
  },
  {
    id: "teaser",
    name: "Teaser",
    use: "Build anticipation before you launch",
    goal: "launch",
    platforms: ["Reels & Shorts", "X"],
    videoType: "launch",
    durationSec: 15,
    format: "vertical",
    tone: "cinematic",
    music: "composed",
    voice: null,
    beats: [
      { from: 0, to: 6, label: "Glimpses", text: "Close, cropped glimpses of the real UI: tease it, don't explain it." },
      { from: 6, to: 11, label: "Tagline", text: "The tagline, one line, big." },
      { from: 11, to: 15, label: "Coming soon", text: "Coming soon, with the launch date or web address." },
    ],
    rules: ["Keep it mysterious: never show the whole product at once."],
  },
  {
    id: "feature-drop",
    name: "Feature Drop",
    use: "Announce a new feature or release",
    goal: "update",
    platforms: ["Changelog", "X", "LinkedIn"],
    videoType: "feature",
    durationSec: 20,
    format: "landscape",
    tone: "polished",
    music: "upbeat",
    voice: null,
    beats: [
      { from: 0, to: 3, label: "What's new", text: "The feature's name, with a version badge if there is one." },
      { from: 3, to: 9, label: "Before", text: "The old way, or the problem." },
      { from: 9, to: 16, label: "After", text: "The new feature working in the real UI." },
      { from: 16, to: 20, label: "Try it", text: "How to try it, with the web address." },
    ],
  },
  {
    id: "walkthrough",
    name: "Walkthrough",
    use: "Show how it works, step by step",
    goal: "explain",
    platforms: ["Homepage", "Docs", "YouTube"],
    videoType: "demo",
    durationSec: 90,
    format: "landscape",
    tone: "polished",
    music: "composed",
    voice: "cole",
    beats: [
      { from: 0, to: 6, label: "Goal", text: "What the viewer will get done." },
      { from: 6, to: 75, label: "Steps", text: "Three or four steps in the real UI, one step per scene, with a step counter and the cursor showing every click." },
      { from: 75, to: 85, label: "Result", text: "The result." },
      { from: 85, to: 90, label: "CTA", text: "Call to action with the web address." },
    ],
  },
  {
    id: "problem-solution",
    name: "Problem → Solution",
    use: "A short ad that starts with the pain",
    goal: "ads",
    platforms: ["Reels & Shorts", "TikTok", "Meta ads"],
    videoType: "launch",
    durationSec: 30,
    format: "vertical",
    tone: "default",
    music: "upbeat",
    voice: "leo",
    beats: [
      { from: 0, to: 3, label: "Pain", text: "The pain, in big type." },
      { from: 3, to: 9, label: "Cost", text: "Time, money or stress." },
      { from: 9, to: 20, label: "Fix", text: "The product solving it in its real UI." },
      { from: 20, to: 26, label: "Proof", text: "A result or number from the site." },
      { from: 26, to: 30, label: "CTA", text: "Call to action with the web address." },
    ],
    rules: ["Say the product's name and show its logo within the first 5 seconds."],
  },
  {
    id: "before-after",
    name: "Before / After",
    use: "The old way vs your way",
    goal: "ads",
    platforms: ["Reels & Shorts", "X"],
    videoType: "feature",
    durationSec: 20,
    format: "vertical",
    tone: "default",
    music: "upbeat",
    voice: null,
    beats: [
      { from: 0, to: 6, label: "Before", text: "The old way, muted and grey." },
      { from: 6, to: 8, label: "Switch", text: "A quick, designed transition." },
      { from: 8, to: 16, label: "After", text: "The product's way, in its own colours." },
      { from: 16, to: 20, label: "Outcome", text: "The outcome as a number or a result, then the web address." },
    ],
  },
  {
    id: "founder-demo",
    name: "Founder Demo",
    use: "A candid demo for YC, Show HN and investors",
    goal: "explain",
    platforms: ["YC", "Show HN", "Investors"],
    videoType: "demo",
    durationSec: 60,
    format: "landscape",
    tone: "deadpan",
    music: "none",
    voice: "cole",
    beats: [
      { from: 0, to: 5, label: "Intro", text: "What it is and who it's for." },
      { from: 5, to: 50, label: "Demo", text: "The product doing its main job, start to finish, in the real UI." },
      { from: 50, to: 60, label: "Ask", text: "Try it at the web address." },
    ],
    rules: ["Keep it plain and honest: no hype words, no stock visuals, just the product working."],
  },
  {
    id: "social-proof",
    name: "Social Proof",
    use: "Show results and what people say",
    goal: "update",
    platforms: ["LinkedIn", "X", "Homepage"],
    videoType: "launch",
    durationSec: 30,
    format: "square",
    tone: "polished",
    music: "upbeat",
    voice: "maya",
    beats: [
      { from: 0, to: 4, label: "Headline", text: "The headline number or result." },
      { from: 4, to: 20, label: "Quotes", text: "Two or three real quotes or results, each on its own card." },
      { from: 20, to: 26, label: "Logos", text: "Customer logos or usage numbers." },
      { from: 26, to: 30, label: "CTA", text: "Call to action with the web address." },
    ],
    rules: ["Use only quotes, names, logos and numbers that appear on the website or in the project. Never invent a testimonial or a statistic; if there are none, show real results from the product instead."],
  },
  {
    id: "readme-loop",
    name: "README Loop",
    use: "A silent loop for your GitHub README",
    goal: "dev",
    platforms: ["GitHub", "Docs"],
    videoType: "demo",
    durationSec: 15,
    format: "landscape",
    tone: "app-store",
    music: "none",
    voice: null,
    beats: [
      { from: 0, to: 4, label: "Command", text: "The command or first action, typed out." },
      { from: 4, to: 12, label: "Result", text: "The result appearing." },
      { from: 12, to: 15, label: "Loop", text: "Ease back to the opening frame, so the loop is seamless." },
    ],
    rules: ["It plays silently on a loop: no voice, no music, and no text that depends on sound. The last frame must match the first."],
  },
];

export const templateById = (id?: string | null): Template | null => TEMPLATES.find((t) => t.id === id) ?? null;
