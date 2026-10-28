import { LIVE_RECIPES } from "@launchreel/core/recipes";
import { RecipeGallery } from "@/components/recipes/recipe-gallery";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Video recipes",
  description: `${LIVE_RECIPES.length} proven recipes for launch, feature, demo and social videos, made from your real product by ${BRAND.name}.`,
};

export default function PublicRecipesPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-4 py-16 md:px-8 md:py-24">
      <p className="text-sm font-medium text-brand">Recipes</p>
      <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-[-0.04em] md:text-5xl">Start from a recipe that works.</h1>
      <p className="mt-4 max-w-2xl text-gray-900">
        {LIVE_RECIPES.length} video recipes for launches, updates, ads and demos. Pick one, paste your website or repo, and {BRAND.name} makes it from your real product. Recipes are free; you only pay credits for the
        video.
      </p>
      <div className="mt-10">
        <RecipeGallery base="public" />
      </div>
    </main>
  );
}
