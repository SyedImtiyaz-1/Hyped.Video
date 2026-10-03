"use client";
import { ArrowRight, Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { normalizeSourceUrl } from "@/lib/source-url";
import { Button } from "./ui/button";

/**
 * The homepage's "paste your URL" box: to the quick start with the URL (new visitors sign up on the way, middleware.ts).
 * A plain GET form underneath, so it works before the page's script loads.
 */
export function StartForm({ className }: { className?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  return (
    <form
      action="/dashboard/start"
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        const normalized = normalizeSourceUrl(url);
        if (!normalized) return setError(true);
        router.push(`/dashboard/start?url=${encodeURIComponent(normalized)}`);
      }}
      className={cn("mx-auto w-full max-w-xl", className)}
    >
      <div className="flex flex-col gap-2 rounded-xl border border-gray-alpha-400 bg-background-100 p-2 shadow-[0_8px_40px_-12px_rgb(0_0_0/0.6)] sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2 px-2">
          <Globe className="size-4 shrink-0 text-gray-900" />
          <input
            name="url"
            value={url}
            onChange={(e) => (setUrl(e.target.value), setError(false))}
            placeholder="yourproduct.com or a GitHub repo"
            aria-label="Your website or GitHub repo"
            aria-invalid={error || undefined}
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-gray-1000 outline-none placeholder:text-gray-900"
          />
        </label>
        <Button type="submit" variant="primary" size="lg" className="shrink-0">
          Make my free video <ArrowRight />
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-left text-[13px] text-red-900" role="alert">
          Enter your website or a GitHub repo, like myapp.com or github.com/you/app.
        </p>
      )}
    </form>
  );
}
