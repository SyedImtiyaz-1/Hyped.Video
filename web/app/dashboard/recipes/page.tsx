import { RecipeBrowser } from "@/components/recipes/recipe-browser";
import { RemixStrip } from "@/components/recipes/remix-strip";
import { PageBody, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Templates" };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <>
      <PageHeader
        title="What are we making today?"
        description="Templates are proven videos you make your own: pick one, add your product, and every choice is filled in. You can still change anything. Templates are free: a video costs the usual credits."
      />
      <PageBody className="space-y-10">
        <RemixStrip />
        <RecipeBrowser url={url} />
      </PageBody>
    </>
  );
}
