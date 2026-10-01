import { TRIAL_CREDITS } from "@launchreel/core/pricing";
import { templateById } from "@launchreel/core/templates";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { getSharedVideo } from "@/lib/data";

export const dynamic = "force-dynamic";

type Shape = "landscape" | "vertical" | "square";
// Each video keeps its own shape, as large as the window allows without scrolling.
const FRAME: Record<Shape, string> = {
  landscape: "aspect-video w-full max-w-4xl",
  vertical: "aspect-[9/16] w-[min(100%,calc(min(78vh,760px)*0.5625))]",
  square: "aspect-square w-[min(100%,min(78vh,640px))]",
};
// The link preview's image and video size.
const SIZE: Record<Shape, [number, number]> = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080] };
const shapeOf = (format: string): Shape => (format === "vertical" || format === "square" ? format : "landscape");

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const video = await getSharedVideo((await params).id);
  if (!video) return { title: "Video not found", robots: { index: false } };
  const [width, height] = SIZE[shapeOf(video.format)];
  const title = video.kind === "reel" ? `A reel captioned with ${BRAND.name}` : `${video.title}: a launch video made with ${BRAND.name}`;
  const description = video.kind === "reel" ? `Captions by ${BRAND.name}. Upload a video and get it back captioned.` : `Made from the product's real UI with ${BRAND.name}. Paste a link, get a launch video.`;
  const images = video.posterUrl ? [{ url: video.posterUrl, width, height }] : undefined;
  return {
    title,
    description,
    // Unlisted: people with the link can watch, but search engines don't list it.
    robots: { index: false, follow: true },
    openGraph: { type: "video.other", title, description, url: `/v/${video.id}`, images, videos: [{ url: video.videoUrl, secureUrl: video.videoUrl, type: "video/mp4", width, height }] },
    twitter: { card: "summary_large_image", title, description, images: video.posterUrl ? [video.posterUrl] : undefined },
  };
}

/** A finished video's public page: the video, what made it, and the way to make one. */
export default async function SharePage({ params }: Props) {
  const video = await getSharedVideo((await params).id);
  if (!video) notFound();
  const template = templateById(video.template ?? "");
  const cta =
    video.kind === "reel"
      ? { href: "/dashboard/reels", label: "Caption your own reel" }
      : template
        ? { href: `/dashboard/new?template=${template.id}`, label: `Make yours with ${template.name}` }
        : { href: "/dashboard", label: "Make one for your product" };
  return (
    <main className="mx-auto flex max-w-[1200px] flex-col items-center px-4 py-12 md:px-8 md:py-16">
      <div className={cn("overflow-hidden rounded-2xl border border-gray-alpha-400 bg-black shadow-[0_24px_80px_-24px_rgb(0_0_0/0.9)]", FRAME[shapeOf(video.format)])}>
        <video
          src={video.videoUrl}
          poster={video.posterUrl ?? undefined}
          controls
          playsInline
          autoPlay
          muted
          preload="metadata"
          aria-label={video.kind === "reel" ? `A reel captioned with ${BRAND.name}` : `${video.title}, made with ${BRAND.name}`}
          className="block size-full"
        />
      </div>
      <h1 className="mt-8 text-center text-2xl font-semibold tracking-[-0.03em] md:text-3xl">{video.title}</h1>
      <p className="mt-2 text-center text-gray-900">
        {video.kind === "reel" ? "Captioned with " : "A launch video made with "}
        <span className="text-brand">{BRAND.name}</span>
        {video.kind === "reel" ? "." : " from the product's real UI."}
      </p>
      <div className="mt-10 flex w-full max-w-md flex-col items-center gap-3 rounded-xl border border-gray-alpha-400 bg-background-200 p-6 text-center">
        <p className="font-semibold">{video.kind === "reel" ? "Your videos, captioned" : "Your product deserves one too"}</p>
        <p className="text-sm text-gray-900">
          {video.kind === "reel" ? "Upload a video and get it back with captions, zooms and sound effects." : "Paste your website or GitHub repo and get a video in about 15 minutes."} {TRIAL_CREDITS} free credits, no card
          needed.
        </p>
        <ButtonLink href={cta.href} variant="primary" size="lg" className="mt-1">
          {cta.label} <ArrowRight />
        </ButtonLink>
      </div>
    </main>
  );
}
