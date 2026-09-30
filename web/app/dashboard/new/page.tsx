import { templateById } from "@launchreel/core/templates";
import { PageBody, PageHeader } from "@/components/ui/page";
import { getDb } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { getRepoTokenPublicKey } from "@/lib/repo-token-key";
import { studioAvailable } from "@/lib/studio";
import { requireUser } from "@/lib/user";
import { NewVideoForm } from "./new-video-form";

export const metadata = { title: "New video" };
export const dynamic = "force-dynamic";

export default async function NewVideoPage({ searchParams }: { searchParams: Promise<{ url?: string; template?: string }> }) {
  const { url, template: templateId } = await searchParams;
  const template = templateById(templateId);
  const user = await requireUser();
  const [publicKey, studio, saved] = await Promise.all([
    getRepoTokenPublicKey(),
    studioAvailable(),
    isDemo ? null : getDb().then((db) => db.repoToken.findUnique({ where: { userId: user.id }, select: { hint: true, createdAt: true, lastUsedAt: true } })),
  ]);
  const repoToken = {
    userId: user.id,
    publicKey,
    saved: saved && { hint: saved.hint, createdAt: saved.createdAt.toISOString(), lastUsedAt: saved.lastUsedAt?.toISOString() ?? null },
    demo: isDemo,
  };
  return (
    <>
      <PageHeader narrow title="New video" description="Point us at a website or repo. We'll plan, build and render a launch video from your real product." />
      <PageBody className="max-w-[880px]">
        <NewVideoForm key={template?.id ?? "blank"} credits={user.credits} initialUrl={url ?? ""} repoToken={repoToken} studioAvailable={studio} template={template} />
      </PageBody>
    </>
  );
}
