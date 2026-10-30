import { ArrowLeft, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/**
 * The editor's frame for what the reel editor can't edit yet (components/reels/reel-editor.tsx has the same layout):
 * a video while its first cut is being made, and product videos. The bar, the library on the left, the stage in the
 * middle, Ask AI on the right, the timeline below; on phones one column.
 */
export function EditorFrame({
  name,
  detail,
  actions,
  library,
  stage,
  side,
  timeline,
}: {
  name: string;
  detail: string;
  actions?: React.ReactNode;
  library: React.ReactNode;
  stage: React.ReactNode;
  side: React.ReactNode;
  timeline: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ButtonLink href="/dashboard" variant="tertiary" size="sm" aria-label="Back to the dashboard">
          <ArrowLeft />
        </ButtonLink>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium text-gray-1000">{name}</h1>
          <p className="truncate text-xs text-gray-900">{detail}</p>
        </div>
        {actions}
      </div>
      <div className="grid gap-4 lg:h-[calc(100dvh-15rem)] lg:min-h-[560px] lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,340px)] lg:gap-5">
        <div className="order-2 min-w-0 lg:order-none lg:overflow-y-auto">
          <p className="mb-3 text-sm font-medium text-gray-1000">Library</p>
          {library}
        </div>
        <div className="order-1 flex min-w-0 items-center justify-center rounded-xl border border-gray-alpha-400 bg-background-200 p-4 lg:order-none">{stage}</div>
        <div className="order-3 flex min-w-0 flex-col lg:order-none">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-1000">
            <Sparkles className="size-3.5 text-brand" /> Ask AI
          </p>
          <div className="flex min-h-[200px] flex-1 flex-col">{side}</div>
        </div>
      </div>
      <div className="mt-4">{timeline}</div>
    </div>
  );
}

/** One line in the library: what the video is made from, or a file of it. */
export function LibraryItem({ icon, title, detail, action }: { icon: React.ReactNode; title: string; detail?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-alpha-400 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gray-alpha-100 text-gray-900 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-1000">{title}</p>
        {detail && <p className="truncate text-[13px] text-gray-900">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

/** A request of the customer's, as the chat shows it. */
export function YouSaid({ children }: { children: React.ReactNode }) {
  return <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-gray-1000 px-3 py-2 text-[13px] leading-relaxed text-background-100">{children}</p>;
}

/** An answer, as the chat shows it. */
export function AiSaid({ children }: { children: React.ReactNode }) {
  return <div className="w-fit max-w-[85%] rounded-lg bg-gray-alpha-100 px-3 py-2 text-[13px] leading-relaxed text-gray-1000">{children}</div>;
}
