import { normalizeSourceUrl } from "./source-url";

// What the homepage's prompt box understands. A model call will do this later (docs/RECIPES.md, "the prompt box"); until
// then the box finds the website or repo in what was typed, and "Auto" picks a recipe from a few telling words. The
// recipe's panel then shows everything, so a wrong guess is one click to change.

// An explicit link first, then a github.com path, then a bare domain ("myapp.com", "app.myapp.io/pricing").
const LINKS = [/https?:\/\/[^\s"'<>]+/i, /\bgithub\.com\/[\w.-]+\/[\w.-]+/i, /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s"'<>]*)?/i];

/** The first website or repo in what someone typed (a full https URL), and the rest of their words. */
export function splitPrompt(text: string): { url: string | null; words: string } {
  for (const link of LINKS) {
    const match = text.match(link);
    const url = match && normalizeSourceUrl(match[0].replace(/[.,;:!?)]+$/, ""));
    if (match && url) return { url, words: text.replace(match[0], " ").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim() };
  }
  return { url: null, words: text.trim() };
}

// The first rule that matches picks the recipe; anything else that says what it wants gets the launch video.
const RULES: [RegExp, string][] = [
  [/\b(readme|loop|gif)\b/i, "readme-loop"],
  [/\b(teaser|tease|coming soon|waitlist)\b/i, "teaser"],
  [/\b(before|after|old way)\b/i, "before-after"],
  [/\b(3|three) features\b/i, "three-features"],
  [/\b(investors?|yc|show hn|founder)\b/i, "founder-demo"],
  [/\b(testimonials?|reviews?|social proof|what (people|customers) say)\b/i, "social-proof"],
  [/\b(demo|walkthrough|how it works|tutorial|step by step|onboarding)\b/i, "walkthrough"],
  [/\b(feature|release|changelog|update|new in|v\d+)\b/i, "feature-drop"],
  [/\b(ads?|tiktok|reels?|shorts|meta|instagram)\b/i, "problem-solution"],
];

/** The recipe "Auto" picks for these words, or null when there are no words (the quick start then decides). */
export function pickRecipe(words: string): string | null {
  if (!words.trim()) return null;
  return RULES.find(([rule]) => rule.test(words))?.[1] ?? "launch-day";
}
