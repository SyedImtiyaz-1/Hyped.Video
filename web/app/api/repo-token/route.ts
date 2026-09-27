import { NextResponse } from "next/server";
import { parseSealedToken } from "@launchreel/core/repo-token";
import { getDb } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { getRepoTokenPublicKey } from "@/lib/repo-token-key";
import { requireUser } from "@/lib/user";

// Saves a customer's GitHub token for private repos. The browser encrypts it before sending, so this route only
// ever receives and stores ciphertext; it has no way to decrypt it (only the render Worker holds that key).
export async function POST(req: Request) {
  if (isDemo) return NextResponse.json({ error: "This is the demo. Private repos are disabled." }, { status: 403 });
  const user = await requireUser();
  const publicKey = await getRepoTokenPublicKey();
  if (!publicKey) return NextResponse.json({ error: "Private repos aren't set up on this server yet." }, { status: 503 });

  const body = (await req.json().catch(() => null)) as { sealed?: unknown; hint?: unknown } | null;
  const sealed = parseSealedToken(body?.sealed);
  const hint = typeof body?.hint === "string" && /^(github_pat|ghp|token)…[A-Za-z0-9_]{4}$/.test(body.hint) ? body.hint : null;
  if (!sealed || !hint) return NextResponse.json({ error: "Send the token encrypted, not as plain text." }, { status: 400 });
  if (sealed.kid !== publicKey.kid) return NextResponse.json({ error: "The encryption key changed. Reload the page and try again." }, { status: 409 });

  const db = await getDb();
  const value = { sealed: JSON.stringify(sealed), hint, createdAt: new Date(), lastUsedAt: null };
  await db.repoToken.upsert({ where: { userId: user.id }, create: { userId: user.id, ...value }, update: value });
  return NextResponse.json({ ok: true, hint });
}

export async function DELETE() {
  if (isDemo) return NextResponse.json({ error: "This is the demo." }, { status: 403 });
  const user = await requireUser();
  await (await getDb()).repoToken.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ ok: true });
}
