import { PageBody, PageHeader } from "@/components/ui/page";
import { normalizeSourceUrl } from "@/lib/source-url";
import { requireUser } from "@/lib/user";
import { QuickStart } from "./quick-start";

export const metadata = { title: "Your first video" };
export const dynamic = "force-dynamic";

/**
 * The quickest way to a video: the product's URL (from the homepage or the dashboard), one confirmation, and the video
 * starts with the house defaults (a 20-second launch video with music). Everything else is one click away in the full
 * form. Signed-out visitors are sent to sign-up first and come back here (middleware.ts).
 */
export default async function StartPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const user = await requireUser();
  const url = normalizeSourceUrl((await searchParams).url ?? "") ?? "";
  return (
    <>
      <PageHeader narrow title="Make your video" description="Your real product, animated with music, in about 15 minutes." />
      <PageBody className="max-w-[880px]">
        <QuickStart initialUrl={url} credits={user.credits} />
      </PageBody>
    </>
  );
}
