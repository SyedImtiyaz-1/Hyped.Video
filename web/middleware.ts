import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { BRAND } from "@/lib/brand";

const isProtected = createRouteMatcher(["/dashboard(.*)", "/api/jobs(.*)", "/api/checkout(.*)", "/api/billing(.*)", "/api/repo-token(.*)", "/api/search(.*)", "/api/reels(.*)"]);

// Demo mode (development only) skips auth entirely; see lib/demo.ts.
const demo = process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

const clerk = clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

// www.hyped.video → hyped.video, keeping the path and query; before Clerk, so sign-in only ever happens on one host.
function toApex(req: NextRequest) {
  if (req.headers.get("host") !== `www.${BRAND.domain}`) return;
  const { pathname, search } = new URL(req.url);
  return NextResponse.redirect(new URL(pathname + search, BRAND.url), 308);
}

export default demo ? () => NextResponse.next() : (req: NextRequest, event: NextFetchEvent) => toApex(req) ?? clerk(req, event);

export const config = {
  matcher: ["/((?!_next|.*\\.(?:css|js|png|jpg|svg|ico|mp4|woff2?)).*)", "/(api|trpc)(.*)", "/__clerk/:path*"],
};
