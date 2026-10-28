import { templateById } from "@launchreel/core/templates";
import { ExampleVideo } from "@/components/showcase/example-video";
import { cn } from "@/lib/cn";
import { SHOWCASE, type ShowcaseVideo } from "@/lib/showcase";

const RATIO: Record<ShowcaseVideo["format"], string> = { landscape: "16:9", vertical: "9:16", square: "1:1" };

// Every tile is as tall as the strip and as wide as its own shape.
const TILE: Record<ShowcaseVideo["format"], string> = { landscape: "aspect-video", vertical: "aspect-[9/16]", square: "aspect-square" };

/**
 * "Made with Hyped" as a moving wall: the gallery's videos at one height, each in its own shape, drifting sideways.
 * Hovering or focusing pauses it and previews the video under the mouse; a click opens it with sound
 * (example-video.tsx). The row is drawn twice so the loop has no seam; with reduced motion it's one row you scroll.
 */
export function ShowcaseMarquee({ videos = SHOWCASE.filter((v) => v.gallery !== false) }: { videos?: readonly ShowcaseVideo[] }) {
  const row = (copy: boolean) => (
    <ul className={cn("flex shrink-0 gap-4 pr-4", copy && "motion-reduce:hidden")} aria-hidden={copy || undefined} inert={copy}>
      {videos.map((v) => {
        const t = templateById(v.template);
        return (
          <li key={v.id} className="shrink-0">
            <figure>
              <div className={cn("h-56 md:h-72", TILE[v.format])}>
                <ExampleVideo video={v} label={`${t?.name ?? "Video"} for ${v.product}`} />
              </div>
              <figcaption className="mt-2.5 text-[13px]">
                <span className="font-medium text-gray-1000">{v.product}</span>
                <span className="text-gray-900">
                  {" "}
                  · {t?.name} · {RATIO[v.format]} · {v.durationSec}s
                </span>
              </figcaption>
            </figure>
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className="group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)] motion-reduce:overflow-x-auto">
      <div className="flex w-max motion-safe:animate-marquee group-focus-within:[animation-play-state:paused] group-hover:[animation-play-state:paused]">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
