/**
 * middleware.ts
 *
 * Edge middleware — runs before every request.
 * Checks for the site_auth httpOnly cookie. Redirects to /login if missing or invalid.
 * Prevents access to /login when already authenticated.
 */

import { NextRequest, NextResponse } from "next/server";

// Paths the middleware should never intercept
const PUBLIC_PREFIXES = [
  "/login",
  "/_next",
  "/fonts",
  "/favicon.ico",
  // Allow API routes to pass through so ingest webhooks still work
  "/api",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── 1. Always allow public paths ────────────────────────────────────────────
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    // If already authenticated, redirect /login → /
    if (pathname.startsWith("/login")) {
      const authToken = process.env.SITE_AUTH_TOKEN;
      const cookie = request.cookies.get("site_auth");
      if (authToken && cookie?.value === authToken) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.next();
  }

  // ── 2. Check auth cookie ─────────────────────────────────────────────────────
  const authToken = process.env.SITE_AUTH_TOKEN;
  const cookie = request.cookies.get("site_auth");

  if (!authToken || !cookie || cookie.value !== authToken) {
    const loginUrl = new URL("/login", request.url);
    // Preserve the intended destination for post-login redirect
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
