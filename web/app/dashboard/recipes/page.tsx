import { RecipeGallery } from "@/components/recipes/recipe-gallery";
import { PageBody, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Recipes" };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <>
      <PageHeader
        title="What are we making today?"
        description="Recipes are proven videos you make your own: pick one, add your product, and every choice is filled in. You can still change anything. Recipes are free: a video costs the usual credits."
      />
      <PageBody>
        <RecipeGallery base="dashboard" url={url} />
      </PageBody>
    </>
  );
}
