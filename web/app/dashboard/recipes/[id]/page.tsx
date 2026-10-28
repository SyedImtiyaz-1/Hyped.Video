import { notFound, redirect } from "next/navigation";
import { recipeById } from "@launchreel/core/recipes";
import { PageBody } from "@/components/ui/page";
import { studioAvailable } from "@/lib/studio";
import { requireUser } from "@/lib/user";
import { RecipePanel } from "./recipe-panel";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  return { title: recipeById((await params).id)?.name ?? "Template" };
}

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ url?: string; notes?: string }> }) {
  const recipe = recipeById((await params).id);
  if (!recipe || recipe.status !== "live") notFound();
  // Reel recipes start from a clip in the reel form; every live recipe today is a product video.
  if (!recipe.video) redirect("/dashboard/reels");
  // The homepage's prompt box sends the words it was given as notes (lib/prompt.ts).
  const [user, studio, { url, notes }] = await Promise.all([requireUser(), studioAvailable(), searchParams]);
  return (
    <PageBody>
      <RecipePanel recipe={recipe} story={recipe.video} credits={user.credits} initialUrl={url ?? ""} initialNotes={notes?.slice(0, 1000) ?? ""} studioAvailable={studio} />
    </PageBody>
  );
}
