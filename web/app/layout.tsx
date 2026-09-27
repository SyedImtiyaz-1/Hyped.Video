import { ClerkProvider } from "@clerk/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { BRAND } from "@/lib/brand";
import { isDemo } from "@/lib/demo";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${BRAND.name}: launch videos from your site or repo`, template: `%s · ${BRAND.name}` },
  description: "Paste a URL or GitHub repo. Get a polished launch video with music, motion and share copy, made from your real product.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const page = (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
  return isDemo ? page : <ClerkProvider>{page}</ClerkProvider>;
}
