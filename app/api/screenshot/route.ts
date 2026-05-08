/**
 * app/api/screenshot/route.ts
 *
 * GET /api/screenshot?url=https://example.com
 *
 * Returns a 1440×900 PNG screenshot of the given URL.
 *
 * IMPORTANT: playwright-core and @sparticuz/chromium are loaded via dynamic
 * import() inside the handler — NOT as top-level imports. This prevents
 * Next.js / Lambda from executing their filesystem setup code at module
 * initialization time, which crashes the function before the handler runs.
 */

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

  // ── Validate URL param ──────────────────────────────────────────────────────
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url")?.trim() ?? "";

  if (!rawUrl) return badRequest("Missing required query parameter: url");

  const targetUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  if (!isValidHttpUrl(targetUrl)) {
    return badRequest(`Invalid URL: "${rawUrl}". Must be a valid http/https URL.`);
  }

  // ── Lazy-load Playwright and Chromium ───────────────────────────────────────
  // Dynamic imports ensure these modules (and their OS/fs side-effects) are
  // only executed when this handler is actually invoked, not at module load.
  const { chromium: playwrightChromium } = await import("playwright-core");
  const { default: chromium } = await import("@sparticuz/chromium");

  // ── Resolve executable path and args for the current environment ────────────
  const isLambda =
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.VERCEL ||
    process.env.NODE_ENV === "production";

  const executablePath = isLambda
    ? await chromium.executablePath()
    : process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? undefined;

  const launchArgs: string[] = isLambda
    ? chromium.args
    : ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];

  // ── Adaptive timeouts based on available function duration ──────────────────
  const maxDurationSec = Number(process.env.VERCEL_MAX_DURATION ?? 10);
  const isHobby = maxDurationSec <= 10;
  const navTimeout = isHobby ? 7_000 : 28_000;
  const settleMs = isHobby ? 400 : 1200;

  // ── Launch browser and capture screenshot ───────────────────────────────────
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

    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: navTimeout });
    await page.waitForTimeout(settleMs);
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
