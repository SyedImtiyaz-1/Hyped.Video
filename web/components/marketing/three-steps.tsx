import { ArrowUp, Check, Copy, Download, Link2, Sparkles } from "lucide-react";

// The three steps, each with a small picture of that moment in the app (drawn here, not screenshots, so they stay sharp).
const STEPS = [
  { title: "Paste it", body: "Your website or repo, or a clip you recorded. Say what you want, or pick a template.", art: <PasteArt /> },
  { title: "Direct it", body: "Ask for changes in plain English. Ask AI edits the captions, cuts, B-roll and music, and every change can be undone.", art: <DirectArt /> },
  { title: "Share it", body: "Download the MP4 with captions and share copy, or send a link to your team.", art: <ShareArt /> },
];

/** "Three steps to your first video": paste, direct, share, each with its moment in the app. */
export function ThreeSteps() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {STEPS.map(({ title, body, art }) => (
        <div key={title}>
          <div aria-hidden className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-200 p-5">
            {art}
          </div>
          <h3 className="mt-4 text-base font-semibold">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-gray-900">{body}</p>
        </div>
      ))}
    </div>
  );
}

function PasteArt() {
  return (
    <div className="w-full max-w-[300px] rounded-xl border border-gray-alpha-400 bg-background-100 p-3 shadow-xl">
      <p className="text-[13px] text-gray-1000">
        <span className="rounded bg-gray-alpha-200 px-1 font-mono text-[12px]">acme.dev</span> A 30-second launch video for Product Hunt
      </p>
      <div className="mt-4 flex items-center gap-1.5">
        <span className="rounded-full bg-gray-alpha-200 px-2 py-0.5 text-[11px] font-medium">Launch Day</span>
        <span className="rounded-full bg-gray-alpha-100 px-2 py-0.5 text-[11px] text-gray-900">16:9</span>
        <span className="ml-auto flex size-7 items-center justify-center rounded-full bg-brand text-brand-ink">
          <ArrowUp className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

function DirectArt() {
  const clips = ["bg-brand/70", "bg-gray-alpha-500", "bg-sky-400/60", "bg-gray-alpha-500", "bg-brand/50"];
  return (
    <div className="w-full max-w-[300px] space-y-2">
      <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-gray-1000 px-3 py-1.5 text-[12px] text-background-100">Cut the intro and make the captions bigger</p>
      <p className="flex w-fit max-w-[85%] items-center gap-1.5 rounded-2xl rounded-bl-md border border-gray-alpha-400 bg-background-100 px-3 py-1.5 text-[12px]">
        <Sparkles className="size-3 shrink-0 text-brand" /> Done: intro trimmed, captions bigger
      </p>
      <div className="relative mt-3 flex h-7 gap-1 rounded-md border border-gray-alpha-400 bg-background-100 p-1">
        {clips.map((c, i) => (
          <span key={i} className={`h-full rounded-sm ${c}`} style={{ flexGrow: [2, 3, 2, 4, 2][i] }} />
        ))}
        <span className="absolute inset-y-[-4px] left-[38%] w-0.5 rounded-full bg-gray-1000" />
      </div>
    </div>
  );
}

function ShareArt() {
  return (
    <div className="w-full max-w-[300px] space-y-2.5">
      <div className="flex items-center gap-2 rounded-lg border border-gray-alpha-400 bg-background-100 px-3 py-2 text-[12px]">
        <Link2 className="size-3.5 shrink-0 text-gray-900" />
        <span className="min-w-0 flex-1 truncate font-mono text-gray-1000">hyped.video/v/8f3k2q</span>
        <span className="flex items-center gap-1 text-brand">
          <Check className="size-3" /> Copied
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {["16:9", "9:16", "1:1"].map((r, i) => (
          <span key={r} className={i === 0 ? "rounded-md bg-gray-1000 px-2 py-1 text-[11px] font-medium text-background-100" : "rounded-md bg-gray-alpha-200 px-2 py-1 text-[11px]"}>
            {r}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1 rounded-md bg-brand px-2 py-1 text-[11px] font-medium text-brand-ink">
          <Download className="size-3" /> MP4
        </span>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-alpha-500 px-3 py-2 text-[11px] text-gray-900">
        <Copy className="size-3 shrink-0" /> Share copy for X, LinkedIn and Product Hunt
      </div>
    </div>
  );
}
