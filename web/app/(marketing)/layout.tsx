import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { BRAND } from "@/lib/brand";
import { isDemo } from "@/lib/demo";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background-100">
      <header className="sticky top-0 z-40 border-b border-gray-alpha-400 bg-background-100/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-4 md:px-8">
          <Link href="/" aria-label={`${BRAND.name} home`}>
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-900 md:flex">
            <a href="#how" className="hover:text-gray-1000">How it works</a>
            <a href="#pricing" className="hover:text-gray-1000">Pricing</a>
            <a href="#faq" className="hover:text-gray-1000">FAQ</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {isDemo ? (
              <ButtonLink href="/dashboard" variant="primary" size="sm">
                Open dashboard
              </ButtonLink>
            ) : (
              <>
                <SignedOut>
                  <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                    <button className={buttonClasses({ size: "sm" })}>Log in</button>
                  </SignInButton>
                  <ButtonLink href="/dashboard" variant="primary" size="sm">
                    Start free
                  </ButtonLink>
                </SignedOut>
                <SignedIn>
                  <ButtonLink href="/dashboard" size="sm">
                    Dashboard
                  </ButtonLink>
                  <UserButton />
                </SignedIn>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
      <footer className="border-t border-gray-alpha-400">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-10 text-sm text-gray-900 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <Logo className="text-sm" />
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#pricing" className="hover:text-gray-1000">Pricing</a>
            <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-gray-1000">Contact</a>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}
