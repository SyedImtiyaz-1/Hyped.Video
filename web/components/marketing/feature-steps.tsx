import { Check, Download, LoaderCircle } from "lucide-react";
import { REEL_STYLES } from "@launchreel/core/captions";
import { VOICES } from "@launchreel/core/voices";
import { cn } from "@/lib/cn";

// What Hyped does at each stage, the first line of each being the headline; with a picture of that stage in the app.
const FEATURES = [
  {
    title: "Write the story",
    items: ["Reads your site or repo and writes the script", "Animates your real UI, copy, colors and fonts", `A voiceover in one of ${VOICES.length} voices, or none`, "Music and sound effects to match", "Stock B-roll where it fits, in reels"],
    art: <StoryArt />,
  },
  {
    title: "Shape the edit",
    items: ["Cuts dead air, filler words and retakes", `Word-by-word captions in ${REEL_STYLES.length} styles`, "Zooms, emojis, sound effects and B-roll", "Change anything by asking, and undo it"],
    art: <EditArt />,
  },
  {
    title: "Publish it",
    items: ["16:9, 9:16 or 1:1, for every feed", "Captions burned in, and an SRT file", "Share copy for X, LinkedIn and Product Hunt", "Edit a reel and export it again, free"],
    art: <PublishArt />,
  },
];

/** "Everything a video needs": the story, the edit and the export, numbered, each with its list and its moment. */
export function FeatureSteps() {
  return (
    <div className="divide-y divide-gray-alpha-400 border-y border-gray-alpha-400">
      {FEATURES.map(({ title, items, art }, i) => (
        <div key={title} className="grid gap-8 py-10 md:grid-cols-[80px_minmax(0,1fr)_minmax(0,1.2fr)] md:items-center md:py-14">
          <span className="font-mono text-2xl text-gray-700">0{i + 1}</span>
          <div>
            <h3 className="text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{title}</h3>
            <ul className="mt-5 space-y-2.5 border-l border-gray-alpha-400 pl-4 text-sm">
              {items.map((item, n) => (
                <li key={item} className={n === 0 ? "font-medium text-gray-1000" : "text-gray-900"}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div aria-hidden className="flex aspect-[16/10] items-center justify-center rounded-2xl border border-gray-alpha-400 bg-[radial-gradient(120%_100%_at_100%_0%,rgb(200_241_53/0.08),transparent_60%)] bg-background-200 p-6">
            {art}
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("w-full max-w-[380px] rounded-xl border border-gray-alpha-400 bg-background-100 p-4 shadow-2xl", className)}>{children}</div>;
}

function StoryArt() {
  const steps = [
    { label: "Reading acme.dev", done: true },
    { label: "Writing the script", done: true },
    { label: "Animating the scenes", done: true },
    { label: "Voiceover and music", done: true },
    { label: "Rendering the MP4", done: false },
  ];
  return (
    <Panel>
      <p className="text-[13px] font-medium">Make a 30-second launch video for acme.dev</p>
      <ul className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12px]">
            {s.done ? <Check className="size-3.5 text-brand" /> : <LoaderCircle className="size-3.5 animate-spin text-gray-900" />}
            <span className={s.done ? "text-gray-1000" : "text-gray-900"}>{s.label}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function EditArt() {
  const lines: { t: string; words: (string | { cut: string })[] }[] = [
    { t: "0:00", words: ["So,", { cut: "um," }, "this is the new dashboard."] },
    { t: "0:04", words: ["Everything you need is", { cut: "uh, like," }, "in one view."] },
    { t: "0:07", words: [{ cut: "You can filter by, let me redo that." }] },
    { t: "0:09", words: ["You can filter by team."] },
  ];
  return (
    <Panel>
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-900">Transcript</p>
      <ul className="mt-2.5 space-y-1.5">
        {lines.map((l) => (
          <li key={l.t} className="flex gap-2.5 text-[12px]">
            <span className="w-7 shrink-0 font-mono text-gray-700">{l.t}</span>
            <span>
              {l.words.map((w, i) =>
                typeof w === "string" ? (
                  <span key={i}>{w} </span>
                ) : (
                  <span key={i} className="text-gray-700 line-through decoration-red-800">
                    {w.cut}{" "}
                  </span>
                ),
              )}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex h-6 items-center gap-[3px]">
        {Array.from({ length: 48 }, (_, i) => (
          <span key={i} className={cn("w-full rounded-full", i > 22 && i < 30 ? "bg-gray-alpha-400" : "bg-brand/70")} style={{ height: `${25 + ((i * 37) % 70)}%` }} />
        ))}
      </div>
    </Panel>
  );
}

function PublishArt() {
  return (
    <Panel className="space-y-3">
      <div className="flex items-center gap-1.5">
        {["16:9", "9:16", "1:1"].map((r, i) => (
          <span key={r} className={i === 1 ? "rounded-md bg-gray-1000 px-2 py-1 text-[11px] font-medium text-background-100" : "rounded-md bg-gray-alpha-200 px-2 py-1 text-[11px]"}>
            {r}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[11px] font-medium text-brand-ink">
          <Download className="size-3" /> Export
        </span>
      </div>
      {[
        ["launch-video.mp4", "1080 × 1920 · 0:30"],
        ["captions.srt", "Word-by-word"],
        ["share-copy.txt", "X, LinkedIn, Product Hunt"],
      ].map(([file, detail]) => (
        <div key={file} className="flex items-center justify-between rounded-lg border border-gray-alpha-400 px-3 py-2 text-[12px]">
          <span className="font-mono text-gray-1000">{file}</span>
          <span className="text-gray-900">{detail}</span>
        </div>
      ))}
    </Panel>
  );
}
