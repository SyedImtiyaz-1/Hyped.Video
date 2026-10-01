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

// The workers.dev address stays up as a fallback for the custom domain, but out of search results: one site, one address.
async function handle(req: NextRequest, event: NextFetchEvent) {
  const apex = toApex(req);
  if (apex) return apex;
  const res = await clerk(req, event);
  if (!req.headers.get("host")?.endsWith(".workers.dev")) return res;
  const out = res ?? NextResponse.next();
  out.headers.set("X-Robots-Tag", "noindex");
  return out;
}

export default demo ? () => NextResponse.next() : handle;

export const config = {
  matcher: ["/((?!_next|.*\\.(?:css|js|png|jpg|svg|ico|mp4|woff2?)).*)", "/(api|trpc)(.*)", "/__clerk/:path*"],
};
