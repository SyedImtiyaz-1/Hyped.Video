import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { LinkPending } from "@/components/ui/link-pending";
import { BRAND, BUSINESS } from "@/lib/brand";
import { isDemo } from "@/lib/demo";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    // The marketing site is always dark: it matches the brand (neon lime on black). The dashboard follows the visitor's theme.
    <div className="dark min-h-dvh bg-background-100 text-gray-1000">
      <header className="sticky top-0 z-40 border-b border-gray-alpha-400 bg-background-100/80 backdrop-blur">
        {/* Logo left, links centred, account buttons right. */}
        <div className="mx-auto grid h-16 max-w-[1200px] grid-cols-[1fr_auto_1fr] items-center gap-8 px-4 md:px-8">
          <Link href="/" aria-label={`${BRAND.name} home`} className="flex h-10 items-center justify-self-start">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-900 md:flex">
            <Link href="/#examples" className="hover:text-gray-1000">
              Examples
            </Link>
            <Link href="/#how" className="hover:text-gray-1000">
              How it works
            </Link>
            <Link href="/recipes" className="hover:text-gray-1000">
              Recipes
            </Link>
            <Link href="/#pricing" className="hover:text-gray-1000">
              Pricing
            </Link>
            <Link href="/#faq" className="hover:text-gray-1000">
              FAQ
            </Link>
          </nav>
          <div className="col-start-3 flex items-center gap-2 justify-self-end">
            {isDemo ? (
              <ButtonLink href="/dashboard" variant="primary" size="sm">
                Open dashboard
                <LinkPending />
              </ButtonLink>
            ) : (
              <>
                <SignedOut>
                  <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                    <button className={buttonClasses({ size: "sm" })}>Log in</button>
                  </SignInButton>
                  <SignUpButton mode="modal" forceRedirectUrl="/dashboard">
                    <button className={buttonClasses({ variant: "primary", size: "sm" })}>Start free</button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <ButtonLink href="/dashboard" size="sm">
                    Dashboard
                    <LinkPending />
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
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <Logo className="text-sm" />
              <span>© {new Date().getFullYear()}</span>
            </div>
            <p className="text-[13px]">
              Operated by {BUSINESS.owner}, {BUSINESS.address[1].split(",")[0]}, {BUSINESS.address[2]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 [&_a]:py-2 md:[&_a]:py-0">
            <Link href="/#pricing" className="hover:text-gray-1000">
              Pricing
            </Link>
            <Link href="/terms" className="hover:text-gray-1000">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-gray-1000">
              Privacy
            </Link>
            <Link href="/refunds" className="hover:text-gray-1000">
              Refunds
            </Link>
            <Link href="/contact" className="hover:text-gray-1000">
              Contact
            </Link>
            <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-gray-1000">
              {BRAND.supportEmail}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
