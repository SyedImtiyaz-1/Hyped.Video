import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { authAppearance } from "@/components/auth/auth-appearance";
import { AuthShell, leaveIfSignedIn } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Log in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  await leaveIfSignedIn((await searchParams).redirect_url);
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to pick up your projects where you left them.">
      <SignIn appearance={authAppearance} />
    </AuthShell>
  );
}
