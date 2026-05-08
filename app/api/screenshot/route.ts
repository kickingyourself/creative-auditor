/**
 * app/api/screenshot/route.ts
 *
 * GET /api/screenshot?url=https://example.com
 *
 * Returns a 1440×900 PNG screenshot of the given URL.
 * Uses @sparticuz/chromium for the serverless-optimized binary and
 * playwright-core as the browser automation driver.
 *
 * This route is configured for Vercel's Node.js runtime with a generous
 * maxDuration so that slow pages don't time-out the serverless function.
 *
 * Local dev: falls back to the locally installed browser (via PLAYWRIGHT_EXECUTABLE_PATH
 * or the playwright-core bundled executable) when not running on Lambda/Vercel.
 */

import { chromium as playwrightChromium } from "playwright-core";
import chromium from "@sparticuz/chromium";

// ── Vercel runtime config ─────────────────────────────────────────────────────
// "nodejs" runtime is required — Edge runtime doesn't support child_process/fs.
// maxDuration is set in vercel.json (10s Hobby / 60s Pro).
// ⚠️  On Hobby (10s): page.goto timeout is reduced to 7s to leave room for
//     launch + screenshot + upload. Slow sites will fail with NAVIGATION_FAILED.
//     On Pro (60s): set maxDuration=60 in vercel.json and VERCEL_MAX_DURATION=60
//     as an env var to unlock full timeouts.
export const runtime = "nodejs";
export const maxDuration = 60; // ignored on Hobby; vercel.json cap takes precedence

// ── Helpers ───────────────────────────────────────────────────────────────────

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(msg: string) {
  return Response.json({ error: msg }, { status: 400 });
}

function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Resolves the Chromium executable path and launch args appropriate for the
 * current environment:
 *
 *   - Vercel / AWS Lambda  → @sparticuz/chromium (downloads & extracts binary)
 *   - Local dev            → PLAYWRIGHT_EXECUTABLE_PATH env var if set,
 *                           otherwise playwright-core's own bundled browser
 */
async function resolveLaunchOptions(): Promise<{
  executablePath: string;
  args: string[];
}> {
  const isLambda =
    !!process.env.AWS_LAMBDA_FUNCTION_NAME || // Vercel uses AWS Lambda under the hood
    !!process.env.VERCEL ||
    process.env.NODE_ENV === "production";

  if (isLambda) {
    // @sparticuz/chromium downloads and extracts a compressed Chromium binary
    // to /tmp on first invocation, then caches it for warm lambdas.
    const executablePath = await chromium.executablePath();
    return {
      executablePath,
      args: chromium.args,
    };
  }

  // Local: prefer an explicit override, then let playwright-core find its own.
  const localPath =
    process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
    // playwright-core exposes its bundled Chrome path via this helper
    // (only works when @playwright/browser-chromium is installed)
    undefined;

  return {
    executablePath: localPath ?? "",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  // ── Auth guard ────────────────────────────────────────────────────────────
  // Accepts the token either as a Bearer header or ?token= query param
  // so the Server Action can call it server-side without CORS issues.
  const expectedToken = process.env.SITE_AUTH_TOKEN;
  if (expectedToken) {
    const authHeader = request.headers.get("authorization") ?? "";
    const queryToken = new URL(request.url).searchParams.get("token") ?? "";
    const provided = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : queryToken;
    if (provided !== expectedToken) return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";

  if (!rawUrl) {
    return badRequest("Missing required query parameter: url");
  }

  const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

  if (!isValidHttpUrl(targetUrl)) {
    return badRequest(`Invalid URL: "${rawUrl}". Must be a valid http/https URL.`);
  }

  const { executablePath, args } = await resolveLaunchOptions();

  const launchOpts = {
    args,
    executablePath: executablePath || undefined,
    headless: true as const,
  };

  let browser: Awaited<ReturnType<typeof playwrightChromium.launch>> | null = null;

  try {
    browser = await playwrightChromium.launch(launchOpts);

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36",
      locale: "en-US",
    });

    const page = await context.newPage();

    // Hobby plan: use a short timeout so we fail fast rather than getting
    // killed mid-flight. Pro plan: can afford the full 30s.
    const isHobby = !process.env.VERCEL_MAX_DURATION || Number(process.env.VERCEL_MAX_DURATION) <= 10;
    const navTimeout = isHobby ? 7_000 : 28_000;
    const settleMs   = isHobby ? 500   : 1200;

    await page.goto(targetUrl, {
      waitUntil: "networkidle",
      timeout: navTimeout,
    });

    // Allow lazy-loaded elements to settle
    await page.waitForTimeout(settleMs);

    // Dismiss cookie banners
    await page.keyboard.press("Escape").catch(() => {});

    const buffer = await page.screenshot({
      type: "png",
      fullPage: false,
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    await context.close();

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Screenshot-Url": encodeURIComponent(targetUrl),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `Screenshot failed: ${message}`, url: targetUrl },
      { status: 502 }
    );
  } finally {
    await browser?.close().catch(() => {});
  }
}
