import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtected = createRouteMatcher(["/dashboard(.*)", "/api/jobs(.*)", "/api/checkout(.*)", "/api/billing(.*)"]);

// Demo mode (development only) skips auth entirely; see lib/demo.ts.
const demo = process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

export default demo
  ? () => NextResponse.next()
  : clerkMiddleware(async (auth, req) => {
      if (isProtected(req)) await auth.protect();
    });

export const config = {
  matcher: ["/((?!_next|.*\\.(?:css|js|png|jpg|svg|ico|mp4|woff2?)).*)", "/(api|trpc)(.*)"],
};
