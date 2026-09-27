import { PageBody, PageHeader } from "@/components/ui/page";
import { requireUser } from "@/lib/user";
import { NewVideoForm } from "./new-video-form";

export const metadata = { title: "New video" };
export const dynamic = "force-dynamic";

export default async function NewVideoPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  const user = await requireUser();
  return (
    <>
      <PageHeader narrow title="New video" description="Point us at a website or repo. We'll plan, build and render a launch video from your real product." />
      <PageBody className="max-w-[880px]">
        <NewVideoForm credits={user.credits} initialUrl={url ?? ""} />
      </PageBody>
    </>
  );
}
