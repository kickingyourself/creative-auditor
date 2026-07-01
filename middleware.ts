/**
 * middleware.ts
 *
 * Next.js Edge Middleware — runs before every request.
 *
 * Auth model:
 *   - Pages: require the site_auth httpOnly cookie (set by /login)
 *   - API routes: same cookie check EXCEPT a narrow allowlist of routes
 *     that must be reachable without a browser session (Alli OAuth callbacks).
 *   - Static assets and the login page itself are always public.
 *
 * When SITE_AUTH_TOKEN is not configured (local dev without .env.local),
 * the gate is skipped entirely so local dev doesn't require login.
 */

import { NextRequest, NextResponse } from "next/server";

// ── Always-public path prefixes (no cookie required) ─────────────────────────

const PUBLIC_PAGE_PREFIXES = [
  "/login",
  "/_next",
  "/fonts",
  "/favicon",       // covers /favicon.ico and /favicon/*
];

// Only the OAuth flow routes need to be reachable without a session.
// The authorize route redirects the browser to Alli; the callback route
// receives the redirect back from Alli's auth server — both happen before
// the user has a valid session on this app.
const PUBLIC_API_PREFIXES = [
  "/api/auth/alli/authorize",
  "/api/auth/alli/callback",
];

// ── Middleware ────────────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authToken = process.env.SITE_AUTH_TOKEN;

  // No auth token configured → local dev without password gate. Allow all.
  if (!authToken) {
    return NextResponse.next();
  }

  // Always-public static and page paths
  if (PUBLIC_PAGE_PREFIXES.some((p) => pathname.startsWith(p))) {
    // If already authenticated, skip the login page
    if (pathname.startsWith("/login")) {
      const cookie = request.cookies.get("site_auth");
      if (cookie?.value === authToken) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.next();
  }

  // Narrow allowlist of public API routes
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // All other paths (pages + API routes) require the auth cookie
  const cookie = request.cookies.get("site_auth");

  if (!cookie || cookie.value !== authToken) {
    // API requests: return 401 JSON instead of an HTML redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Page requests: redirect to /login with return destination
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
