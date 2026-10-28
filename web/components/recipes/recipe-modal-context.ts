"use client";
import { createContext, useContext } from "react";
import type { Recipe } from "@launchreel/core/recipes";

/** What a recipe opens with: the link and words typed in the prompt box, or the shape the gallery is filtered to. */
export type RecipeOpenOptions = { url?: string; notes?: string; format?: Recipe["format"] };

export const RecipeModalContext = createContext<{ open: (id: string, options?: RecipeOpenOptions) => void } | null>(null);

/** Opens a recipe in the dashboard's modal (recipe-modal.tsx). Null outside the dashboard, where recipes are pages. */
export const useRecipeModal = () => useContext(RecipeModalContext);
