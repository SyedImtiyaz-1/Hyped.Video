"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { REEL_MAX_BYTES } from "@launchreel/core/reel";
import { savePendingClip } from "@/lib/pending-clip";

/** What a clip picker accepts: the reel form's formats. */
export const CLIP_ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm";

/**
 * A clip the customer recorded, handed to the reel form: checked here, then kept in this browser (through sign-up too)
 * while the form opens. If it can't be kept, the form asks for it again. `start` returns what's wrong with the file, if
 * anything.
 */
export function useClip() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start(picked: File | undefined): Promise<string | null> {
    if (!picked || busy) return null;
    if (!/^video\//.test(picked.type) && !/\.(mp4|m4v|mov|webm)$/i.test(picked.name)) return "Add a video: MP4, MOV or WebM.";
    if (picked.size > REEL_MAX_BYTES) return `Videos can be up to ${Math.round(REEL_MAX_BYTES / 1024 ** 3)} GB.`;
    setBusy(true);
    const kept = await savePendingClip(picked, "creator");
    router.push(`/dashboard/reels?pending=${kept ? 1 : 0}&style=creator`);
    return null;
  }
  return { busy, start };
}
