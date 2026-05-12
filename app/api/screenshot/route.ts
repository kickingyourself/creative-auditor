/**
 * app/api/screenshot/route.ts
 *
 * GET /api/screenshot?url=https://example.com
 *
 * Returns a 1440×900 PNG screenshot of the given URL.
 *
 * Uses @sparticuz/chromium-min (no bundled /bin) + a remote Chromium binary
 * URL that gets downloaded to /tmp at runtime. This is required on Vercel
 * because the deployment bundle excludes large binary asset directories.
 *
 * playwright-core and @sparticuz/chromium-min are loaded via dynamic import()
 * so they have zero presence in the static module graph (prevents build-time
 * bundling failures).
 */

// Remote Chromium binary — architecture-specific tar from the GitHub release.
// Vercel Lambda runs on x64 Linux. Update this URL when upgrading chromium-min.
// Source: https://github.com/Sparticuz/chromium/releases/tag/v148.0.0
const CHROMIUM_REMOTE_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

export const runtime = "nodejs";
export const maxDuration = 60; // vercel.json cap takes precedence on Hobby (10s)

// ── Helpers ───────────────────────────────────────────────────────────────────

function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(msg: string): Response {
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const expectedToken = process.env.SITE_AUTH_TOKEN;
  if (expectedToken) {
    const authHeader = request.headers.get("authorization") ?? "";
    const queryToken = new URL(request.url).searchParams.get("token") ?? "";
    const provided = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : queryToken;
    if (provided !== expectedToken) return unauthorized();
  }

  // ── Validate URL ────────────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";

  if (!rawUrl) return badRequest("Missing required query parameter: url");

  const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  if (!isValidHttpUrl(targetUrl)) {
    return badRequest(`Invalid URL: "${rawUrl}". Must be a valid http/https URL.`);
  }

  // ── Lazy-load Playwright and Chromium ───────────────────────────────────────
  const { chromium: playwrightChromium } = await import("playwright-core");
  const { default: chromium } = await import("@sparticuz/chromium-min");

  // ── Resolve executable path for the current environment ─────────────────────
  const isLambda =
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.VERCEL ||
    process.env.NODE_ENV === "production";

  // chromium-min requires an explicit remote URL (no bundled /bin directory).
  // On Lambda/Vercel it downloads + caches the binary in /tmp on first call.
  // Locally, fall back to PLAYWRIGHT_EXECUTABLE_PATH or the system Chrome.
  const executablePath = isLambda
    ? await chromium.executablePath(CHROMIUM_REMOTE_URL)
    : process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? undefined;

  const launchArgs: string[] = isLambda
    ? chromium.args
    : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

  // ── Adaptive timeouts ───────────────────────────────────────────────────────
  const maxDurationSec = Number(process.env.VERCEL_MAX_DURATION ?? 10);
  const isHobby = maxDurationSec <= 10;
  const navTimeout = isHobby ? 7_000 : 28_000;
  const settleMs = isHobby ? 400 : 1200;

  // ── Launch + screenshot ─────────────────────────────────────────────────────
  let browser: Awaited<ReturnType<typeof playwrightChromium.launch>> | null = null;

  try {
    browser = await playwrightChromium.launch({
      args: launchArgs,
      executablePath: executablePath || undefined,
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/124.0.0.0 Safari/537.36",
      locale: "en-US",
    });

    const page = await context.newPage();

    // Tiered wait: 'load' first, fall back to 'domcontentloaded' for sites
    // with persistent connections (PayPal, Stripe, etc.) that never reach networkidle.
    try {
      await page.goto(targetUrl, { waitUntil: "load", timeout: navTimeout });
    } catch {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: navTimeout });
    }
    await page.waitForTimeout(settleMs);
    await page.keyboard.press("Escape").catch(() => { });

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
    await browser?.close().catch(() => { });
  }
}
