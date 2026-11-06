import { SignUp } from "@clerk/nextjs";
import { TRIAL_CREDITS } from "@launchreel/core/pricing";
import type { Metadata } from "next";
import { authAppearance } from "@/components/auth/auth-appearance";
import { AuthShell, leaveIfSignedIn } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  await leaveIfSignedIn((await searchParams).redirect_url);
  return (
    <AuthShell title="Make your first video" subtitle={`Paste a link or drop a clip. Hyped edits it. ${TRIAL_CREDITS} free credits to start.`}>
      <SignUp appearance={authAppearance} />
    </AuthShell>
  );
}
