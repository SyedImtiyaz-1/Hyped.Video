"use client";
import { ExternalLink, Lock, ShieldCheck } from "lucide-react";
import { sealToken, tokenHint, type RepoTokenJwk } from "@launchreel/core/repo-token";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { timeAgo } from "@/lib/format";

export type SavedRepoToken = { hint: string; createdAt: string; lastUsedAt: string | null } | null;
export type RepoTokenSetup = { userId: string; publicKey: RepoTokenJwk | null; saved: SavedRepoToken; demo: boolean };

const TOKEN = /^(github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,})$/;
const REPO = /github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

/**
 * Checks the token against the repo with GitHub (straight from this browser), encrypts it here to the render
 * Worker's public key and saves the ciphertext. Returns a message for the customer, or null when it's saved.
 * Only the render Worker can decrypt it (see packages/core/src/repo-token.ts).
 */
export async function saveRepoToken(token: string, repoUrl: string, setup: RepoTokenSetup): Promise<string | null> {
  if (!setup.publicKey) return "Private repos aren't set up on this server yet.";
  if (!TOKEN.test(token)) return "That doesn't look like a GitHub token. It starts with github_pat_ (or ghp_ for classic tokens).";
  const repo = repoUrl.match(REPO);
  if (!repo) return "Enter the repo URL like https://github.com/owner/repo";
  const check = await fetch(`https://api.github.com/repos/${repo[1]}/${repo[2]}`, {
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
  });
  if (check.status === 401) return "GitHub rejected this token. It may be mistyped, expired or revoked.";
  if (!check.ok) return `This token can't read ${repo[1]}/${repo[2]}. Give it Contents: read-only access to that repository.`;

  const sealed = await sealToken(token, setup.userId, setup.publicKey);
  const res = await fetch("/api/repo-token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sealed, hint: tokenHint(token) }),
  });
  if (res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "Couldn't save the GitHub token. Try again.";
}

/** The GitHub token field under the repo link: only needed for private repos. */
export function PrivateRepoToken({
  setup,
  token,
  onToken,
  replacing,
  onReplace,
  onRemove,
  busy,
}: {
  setup: RepoTokenSetup;
  token: string;
  onToken: (value: string) => void;
  replacing: boolean;
  onReplace: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const available = Boolean(setup.publicKey) && !setup.demo;

  if (setup.saved && !replacing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-alpha-400 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5 text-[13px] text-gray-900">
          <Lock className="size-4 shrink-0" />
          <span>
            Private repos use your saved token <span className="font-mono text-gray-1000">{setup.saved.hint}</span>
            {setup.saved.lastUsedAt ? `, last used ${timeAgo(setup.saved.lastUsedAt)}` : ""}.
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="tertiary" onClick={onReplace} disabled={busy}>
            Replace
          </Button>
          <Button type="button" size="sm" variant="tertiary" onClick={onRemove} disabled={busy}>
            Remove
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor="githubToken">GitHub token (private repos only)</Label>
      <Input
        id="githubToken"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={token}
        onChange={(e) => onToken(e.target.value)}
        placeholder="github_pat_…  Leave empty for a public repo"
        prefix={<Lock />}
        disabled={!available}
      />
      <p className="mt-2 text-[13px] text-gray-900">
        Create a{" "}
        <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gray-1000 underline underline-offset-2">
          fine-grained token <ExternalLink className="size-3" />
        </a>{" "}
        with access to this repository and <span className="text-gray-1000">Contents: read-only</span>, nothing else.
      </p>
      <p className="mt-1.5 flex items-start gap-2 text-[13px] text-gray-900">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-green-900" />
        <span>
          Encrypted in your browser before it&apos;s sent. Only our render service can decrypt it, to download your repo. It&apos;s never stored or logged in readable form, and
          the AI agent never gets it.
        </span>
      </p>
      {setup.demo && <p className="mt-1.5 text-[13px] text-gray-900">This is the demo: private repos are disabled.</p>}
      {!setup.demo && !setup.publicKey && <p className="mt-1.5 text-[13px] text-amber-900">Private repos aren&apos;t set up on this server yet.</p>}
    </div>
  );
}
