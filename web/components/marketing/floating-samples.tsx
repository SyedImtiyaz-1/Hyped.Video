import { templateById } from "@launchreel/core/templates";
import { ExampleVideo } from "@/components/showcase/example-video";
import { cn } from "@/lib/cn";
import { SHOWCASE, type ShowcaseVideo } from "@/lib/showcase";

// The tiles around the hero's prompt box: which video, where it sits, its tilt and where in the bob it starts.
const TILES: { id: string; spot: string; tilt: number; delay: string }[] = [
  { id: "cmus8frem0009oufwfpyjq0nr", spot: "left-[7%] top-[9%]", tilt: -9, delay: "0s" },
  { id: "cmuo53uiq000louici7g2ta4h", spot: "left-[2%] top-[42%]", tilt: -5, delay: "-2.5s" },
  { id: "cmus8freq000boufw3slpyvda", spot: "left-[11%] bottom-[9%]", tilt: 7, delay: "-5s" },
  { id: "cmus8fre70003oufwod3jw8or", spot: "right-[8%] top-[8%]", tilt: 8, delay: "-1.5s" },
  { id: "cmuo53uhi0007ouicxewkq6xd", spot: "right-[2%] top-[44%]", tilt: 6, delay: "-4s" },
  { id: "cmus8frei0007oufwdk6g8a85", spot: "right-[12%] bottom-[8%]", tilt: -7, delay: "-6s" },
];

// Each tile's size follows its video's shape.
const SIZE: Record<ShowcaseVideo["format"], string> = { landscape: "aspect-video w-56", vertical: "aspect-[9/16] w-32", square: "aspect-square w-40" };

/**
 * Videos Hyped made, scattered around the hero and bobbing gently: a glimpse of what comes out before anyone scrolls.
 * Hover previews one, a click plays it with sound (example-video.tsx). Wide screens only; still with reduced motion.
 */
export function FloatingSamples() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden xl:block">
      {TILES.map(({ id, spot, tilt, delay }) => {
        const video = SHOWCASE.find((v) => v.id === id);
        if (!video) return null;
        return (
          <div
            key={id}
            className={cn("pointer-events-auto absolute shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] [transform:rotate(var(--tilt))] motion-safe:animate-float", spot, SIZE[video.format])}
            style={{ "--tilt": `${tilt}deg`, animationDelay: delay } as React.CSSProperties}
          >
            <ExampleVideo video={video} label={`${templateById(video.template)?.name ?? "Video"} for ${video.product}`} />
          </div>
        );
      })}
    </div>
  );
}
