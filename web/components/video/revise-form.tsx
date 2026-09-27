"use client";
import { WandSparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function ReviseForm({ jobId, credits }: { jobId: string; credits: number }) {
  const router = useRouter();
  const [change, setChange] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (change.trim().length < 3) return setError({ message: "Describe the change you want." });
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/revise`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ change }) });
      const data = await res.json();
      if (!res.ok) return setError({ message: data.error ?? "Could not start the revision", upgrade: data.upgrade });
      router.push(`/dashboard/videos/${data.id}`);
    } catch {
      setError({ message: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Textarea
        value={change}
        onChange={(e) => {
          setChange(e.target.value);
          if (error) setError(null);
        }}
        rows={3}
        placeholder="Make the hook punchier, and end on our pricing line"
        aria-label="Describe the change"
      />
      {error && (
        <p className="text-[13px] text-red-900">
          {error.message}
          {error.upgrade && (
            <>
              {" "}
              <Link href="/dashboard/billing" className="underline underline-offset-2">
                Get more credits
              </Link>
            </>
          )}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-gray-900">1 credit · you have {credits}</p>
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          <WandSparkles />
          {busy ? "Starting…" : "Request change"}
        </Button>
      </div>
    </form>
  );
}
