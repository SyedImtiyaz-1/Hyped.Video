import { ClerkLoading } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { serifUpright } from "@/components/create/serif";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/cn";
import { AuthShowcase } from "./auth-showcase";

/**
 * Someone already signed in has nothing to do here (Clerk's forms render nothing for them): on to where they were
 * going, if that's a page of ours, else the dashboard.
 */
export async function leaveIfSignedIn(redirectUrl?: string) {
  if (!(await auth()).userId) return;
  let to = "/dashboard";
  const host = (await headers()).get("host");
  if (redirectUrl && host) {
    try {
      const url = new URL(redirectUrl, `http://${host}`);
      if (url.host === host) to = url.pathname + url.search; // a page of ours, never another site
    } catch {}
  }
  redirect(to);
}

/**
 * The sign-in and sign-up pages, always dark: the form on the left under a serif heading, and on wide screens a panel
 * on the right with videos Hyped made and the prompt box writing what people ask for (auth-showcase.tsx).
 */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="dark min-h-dvh bg-[#08080a] text-[#ededed]">
      <div className="grid min-h-dvh gap-4 p-4 lg:grid-cols-2">
        <main className="flex items-center justify-center px-2 py-12 lg:px-12">
          <div className="w-full max-w-[400px]">
            <Link href="/" aria-label="Hyped home" className="inline-block">
              <LogoMark className="size-10" />
            </Link>
            <h1 className={cn(serifUpright.className, "mt-6 text-[44px] leading-[1.05] tracking-[-0.02em] text-white text-balance")}>{title}</h1>
            <p className="mt-2 text-[15px] text-[#8f8f95]">{subtitle}</p>
            <div className="mt-8">
              <ClerkLoading>
                <FormSkeleton />
              </ClerkLoading>
              {children}
            </div>
            <p className="mt-5 text-[12px] text-[#6b6b72]">
              By continuing, you agree to the{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-[#a1a1a8]">Terms of Service</Link> and{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-[#a1a1a8]">Privacy Policy</Link>.
            </p>
          </div>
        </main>
        <AuthShowcase />
      </div>
    </div>
  );
}

/** The form's shape while Clerk's script loads (seconds on a slow line), so the page never shows a gap where it goes. */
function FormSkeleton() {
  return (
    <div aria-label="Loading" className="space-y-5 motion-safe:animate-pulse">
      <div className="h-[42px] rounded-[10px] bg-white/85" />
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <div className="h-2 w-5 rounded bg-white/10" />
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="h-[44px] rounded-[10px] border border-white/10 bg-[#141416]" />
      </div>
      <div className="h-[42px] rounded-[10px] bg-[#232326]" />
    </div>
  );
}
