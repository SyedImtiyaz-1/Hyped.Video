import type { Recipe } from "@launchreel/core/recipes";

// Shared by the recipe card, panel and public page. A plain module (no "use client"), so server pages can import it.
export const RATIO: Record<Recipe["format"], string> = { landscape: "16:9", vertical: "9:16", square: "1:1" };
export const TIER_LABEL: Record<Recipe["tier"], string> = { standard: "Standard", studio: "Studio" };
