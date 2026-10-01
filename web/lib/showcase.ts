import type { Template } from "@launchreel/core/templates";

/** The render Worker's public media route (render/src/index.ts serveMedia), where finished videos are served. */
export const MEDIA_URL = "https://media.hyped.video";

/**
 * Videos Hyped made of real products, shown on the site exactly as rendered: no hand editing. Each one is a finished
 * render copied into R2 under jobs/<id>/ (brag.mp4 and its brag.jpg poster). Only products we may show: Hyped's own
 * site and repo, and the owner's AutoApply.
 */
export type ShowcaseVideo = {
  id: string;
  template: string;
  product: string;
  format: Template["format"];
  durationSec: number;
  voice: boolean;
};

export const SHOWCASE: readonly ShowcaseVideo[] = [
  { id: "cmuo53uiq000louici7g2ta4h", template: "launch-day", product: "autoapply.in", format: "landscape", durationSec: 60, voice: true },
  { id: "cmuo53uhi0007ouicxewkq6xd", template: "feature-drop", product: "hyped.video", format: "landscape", durationSec: 20, voice: false },
];

/** The homepage hero: a launch film Hyped made of a real product (the owner's AutoApply). */
export const HERO = SHOWCASE.find((v) => v.id === "cmuo53uiq000louici7g2ta4h");

export const videoSrc = (v: ShowcaseVideo) => `${MEDIA_URL}/jobs/${v.id}/brag.mp4`;
export const posterSrc = (v: ShowcaseVideo) => `${MEDIA_URL}/jobs/${v.id}/brag.jpg`;

/** The example to preview on a template's card, if there is one. */
export const showcaseFor = (templateId: string) => SHOWCASE.find((v) => v.template === templateId);
