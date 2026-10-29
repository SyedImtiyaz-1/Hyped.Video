"use client";
import { LoaderCircle } from "lucide-react";
import { useLinkStatus } from "next/link";

/** Inside a <Link>: a spinner while the page it opens is on its way, so a slow load never looks like a dead button. */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return pending ? <LoaderCircle className="animate-spin" aria-label="Opening" /> : null;
}
