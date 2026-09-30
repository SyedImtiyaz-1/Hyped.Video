import { TemplateGallery } from "@/components/templates/template-gallery";
import { PageBody, PageHeader } from "@/components/ui/page";

export const metadata = { title: "Templates" };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  return (
    <>
      <PageHeader
        title="Templates"
        description="Proven recipes for the videos people make most. Pick one and every step is filled in for your product; you can still change anything. Templates are free: a video costs the usual credits."
      />
      <PageBody>
        <TemplateGallery url={url} />
      </PageBody>
    </>
  );
}
