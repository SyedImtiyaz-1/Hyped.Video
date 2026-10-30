import { templateById } from "@launchreel/core/templates";
import { ExampleVideo } from "@/components/showcase/example-video";
import { SHOWCASE } from "@/lib/showcase";

/**
 * "Made with Hyped": every finished sample, each at its own shape, in columns that pack them like a wall of screens.
 * Hover previews one, a click plays it with sound (example-video.tsx).
 */
export function MadeWith() {
  const videos = SHOWCASE.filter((v) => v.gallery !== false);
  return (
    <div className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4 [&>*]:mb-3 md:[&>*]:mb-4">
      {videos.map((v) => (
        <div key={v.id} className="break-inside-avoid">
          <ExampleVideo video={v} label={`${templateById(v.template)?.name ?? "Video"} for ${v.product}`} className="block h-auto w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
