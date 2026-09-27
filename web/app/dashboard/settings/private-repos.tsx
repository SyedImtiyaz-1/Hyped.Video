"use client";
import { ExternalLink, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sealToken, tokenHint, type RepoTokenJwk } from "@launchreel/core/repo-token";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { formatDateTime, timeAgo } from "@/lib/format";

type Saved = { hint: string; createdAt: string; lastUsedAt: string | null } | null;

const TOKEN = /^(github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,})$/;
const REPO = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

/**
 * The customer's GitHub token is checked with GitHub and encrypted right here in the browser. Only ciphertext
 * is sent to our server, and only the render Worker can decrypt it (see packages/core/src/repo-token.ts).
 */
export function PrivateRepos({ userId, publicKey, saved, demo }: { userId: string; publicKey: RepoTokenJwk | null; saved: Saved; demo: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [repo, setRepo] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const disabled = demo || !publicKey;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = token.trim();
    if (!publicKey) return;
    if (!TOKEN.test(value)) return setStatus({ ok: false, text: "That doesn't look like a GitHub token. It starts with github_pat_ (or ghp_ for classic tokens)." });
    setBusy(true);
    setStatus(null);
    try {
      // Optional check with GitHub. It goes straight from this browser to GitHub, never through our servers.
      const match = repo.trim() ? repo.trim().match(REPO) : null;
      if (repo.trim() && !match) return setStatus({ ok: false, text: "Enter the test repo like https://github.com/owner/repo" });
      if (match) {
        const res = await fetch(`https://api.github.com/repos/${match[1]}/${match[2]}`, {
          headers: { authorization: `Bearer ${value}`, accept: "application/vnd.github+json" },
        });
        if (res.status === 401) return setStatus({ ok: false, text: "GitHub rejected this token. It may be mistyped, expired or revoked." });
        if (!res.ok) return setStatus({ ok: false, text: `This token can't read ${match[1]}/${match[2]}. Give it read access to Contents for that repository.` });
      }
      const sealed = await sealToken(value, userId, publicKey);
      const res = await fetch("/api/repo-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sealed, hint: tokenHint(value) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setStatus({ ok: false, text: data.error ?? "Couldn't save the token. Try again." });
      setToken("");
      setRepo("");
      setStatus({ ok: true, text: match ? `Saved. The token can read ${match[1]}/${match[2]}.` : "Saved." });
      router.refresh();
    } catch {
      setStatus({ ok: false, text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/repo-token", { method: "DELETE" });
      if (!res.ok) return setStatus({ ok: false, text: "Couldn't remove the token. Try again." });
      setStatus({ ok: true, text: "Removed. Also revoke it on GitHub if you no longer use it." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Private repositories"
        description="Make videos from private GitHub repos. Save a read-only token once; we use it only to download the repo for your videos."
        actions={saved ? <Badge tone="green">Connected</Badge> : null}
      />
      <CardContent className="space-y-5">
        {saved && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-alpha-400 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Lock className="size-4 shrink-0 text-gray-900" />
              <span className="font-mono text-sm">{saved.hint}</span>
              <span className="text-[13px] text-gray-900">
                Added {formatDateTime(saved.createdAt)} · {saved.lastUsedAt ? `last used ${timeAgo(saved.lastUsedAt)}` : "not used yet"}
              </span>
            </div>
            <Button type="button" size="sm" onClick={remove} disabled={busy || demo}>
              <Trash2 />
              Remove
            </Button>
          </div>
        )}

        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-900">
          <li>
            On GitHub, create a{" "}
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-1000 underline underline-offset-2">
              fine-grained token <ExternalLink className="size-3" />
            </a>
            .
          </li>
          <li>Repository access: <span className="text-gray-1000">Only select repositories</span>, and pick the ones you want videos for.</li>
          <li>Permissions: <span className="text-gray-1000">Contents → Read-only</span>. Nothing else. Set an expiry, for example 90 days.</li>
        </ol>

        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="gh-token">{saved ? "Replace with a new token" : "GitHub token"}</Label>
            <Input id="gh-token" type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" disabled={disabled} />
          </div>
          <div>
            <Label htmlFor="gh-repo">Check it can read a repo (optional)</Label>
            <Input id="gh-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/owner/private-repo" disabled={disabled} inputMode="url" />
          </div>
          <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-[13px] text-gray-900">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green-900" />
              <span>
                Encrypted in your browser before it&apos;s sent. Only our render service can decrypt it, at the moment it downloads your repo. It&apos;s never stored or logged
                in readable form, and the AI agent never gets it. Remove it here or revoke it on GitHub at any time.
              </span>
            </p>
            <Button type="submit" variant="primary" className="shrink-0" disabled={disabled || busy || !token}>
              {busy ? "Working…" : "Encrypt and save"}
            </Button>
          </div>
        </form>

        {status && (
          <p role="status" className={cn("text-[13px]", status.ok ? "text-green-900" : "text-red-900")}>
            {status.text}
          </p>
        )}
        {demo && <p className="text-[13px] text-gray-900">This is the demo: saving is disabled.</p>}
        {!demo && !publicKey && <p className="text-[13px] text-amber-900">Private repos aren&apos;t set up on this server yet (REPO_TOKEN_PUBLIC_KEY is missing).</p>}
      </CardContent>
    </Card>
  );
}
