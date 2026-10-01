import { templateById } from "@launchreel/core/templates";
import { ExampleVideo } from "@/components/showcase/example-video";
import { SHOWCASE, type ShowcaseVideo } from "@/lib/showcase";

const RATIO: Record<ShowcaseVideo["format"], string> = { landscape: "16:9", vertical: "9:16", square: "1:1" };

/** "Made with Hyped": finished videos of real products, each with the template and settings that made it. */
export function ShowcaseGallery({ videos = SHOWCASE }: { videos?: readonly ShowcaseVideo[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => {
        const t = templateById(v.template);
        return (
          <figure key={v.id} className="flex flex-col overflow-hidden rounded-xl border border-gray-alpha-400 bg-background-100">
            <div className="flex aspect-[16/10] items-center justify-center border-b border-gray-alpha-400 bg-background-200 p-4">
              <ExampleVideo video={v} label={`${t?.name ?? "Video"} for ${v.product}`} />
            </div>
            <figcaption className="p-4">
              <p className="text-sm font-semibold">{v.product}</p>
              <p className="mt-0.5 text-[13px] text-gray-900">
                {t?.name} · {RATIO[v.format]} · {v.durationSec}s · {v.voice ? "Voiceover" : "Music only"}
              </p>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
