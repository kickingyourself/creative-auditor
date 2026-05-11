'use server';

/**
 * actions/scrape-homepage.ts
 *
 * Server Action: scrapeHomepage
 *
 * Accepts a brand homepage URL, launches a headless Chromium session via
 * Playwright, captures a full-page screenshot, uploads it to the
 * `creative-assets` Supabase Storage bucket, and inserts a row into the
 * `creatives` table with platform = 'homepage'.
 *
 * Called from a Client Component using React's useActionState hook.
 * Signature matches the useActionState contract:
 *   (prevState: ScrapeState, formData: FormData) => Promise<ScrapeState>
 */

import { createClient } from '@supabase/supabase-js';
import type { Database, CreativeInsert, CreativeRow } from '@/types/database.types';

// ─── Return type surfaced to the Client Component ─────────────────────────────

export type ScrapeState =
  | { status: 'idle' }
  | { status: 'success'; creativeId: string; thumbnailUrl: string; sourceUrl: string }
  | { status: 'error'; message: string; code: string };

// ─── Supabase server client ───────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('MISSING_SUPABASE_CONFIG');
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

// ─── URL validation ───────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  // Prepend https:// if no protocol given
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function isValidHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Storage path helper ──────────────────────────────────────────────────────

function buildStoragePath(brandId: string): string {
  const timestamp = Date.now();
  // e.g. screenshots/abc-123/1746652800000.png
  return `screenshots/${brandId}/${timestamp}.png`;
}

// ─── UUID validation ──────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the value if it is a well-formed UUID, otherwise null.
 * Handles empty strings and browser-autofilled date strings (e.g. "20260507").
 */
function toUuidOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

// ─── Main Server Action ───────────────────────────────────────────────────────

export async function scrapeHomepage(
  _prevState: ScrapeState,
  formData: FormData
): Promise<ScrapeState> {

  // ── 1. Extract & validate form data ────────────────────────────────────────
  const rawUrl = (formData.get('url') as string | null) ?? '';
  const rawBrandId = (formData.get('brand_id') as string | null) ?? '';
  const brandId = toUuidOrNull(rawBrandId);
  // campaign_id is optional — coerce empty strings / autofilled non-UUIDs to null
  const campaignId = toUuidOrNull(formData.get('campaign_id') as string | null);

  if (!rawUrl.trim()) {
    return { status: 'error', code: 'MISSING_URL', message: 'Please enter a URL to scrape.' };
  }
  if (!brandId) {
    return {
      status: 'error',
      code: 'MISSING_BRAND',
      message: `brand_id is missing or not a valid UUID (got: "${rawBrandId}").`,
    };
  }

  const targetUrl = normalizeUrl(rawUrl);
  if (!isValidHttpUrl(targetUrl)) {
    return {
      status: 'error',
      code: 'INVALID_URL',
      message: `"${rawUrl}" is not a valid URL. Include the domain (e.g. nike.com).`,
    };
  }

  // Snapshot timestamp — embedded in source_url to make each scrape unique
  // and displayed as a visible date stamp on the screenshot itself.
  const snapshotAt = new Date();
  const snapshotIso = snapshotAt.toISOString(); // e.g. "2025-05-08T23:31:00.000Z"
  // Human-readable label for the overlay badge, e.g. "May 8, 2025 · 6:31 PM"
  const snapshotLabel = snapshotAt.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  // source_url encodes the snapshot time so every row is unique per brand
  const snapshotUrl = `${targetUrl}?_snapshot=${encodeURIComponent(snapshotIso)}`;

  // ── 2. Launch headless Chromium ────────────────────────────────────────────
  // Both playwright-core and @sparticuz/chromium are loaded via dynamic import
  // so they have ZERO presence in the static module graph. This prevents
  // Next.js / webpack from attempting to bundle them at build time, which
  // crashes the entire app (not just the scrape endpoint).
  const { chromium } = await import('playwright-core');

  const isLambda =
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.VERCEL ||
    process.env.NODE_ENV === 'production';

  // chromium-min has no bundled /bin — must supply a remote URL for the binary.
  // It downloads and caches to /tmp on first Lambda invocation.
  const CHROMIUM_REMOTE_URL =
    'https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar';

  const { default: sparticuzChromium } = isLambda
    ? await import('@sparticuz/chromium-min')
    : { default: null };

  const executablePath = isLambda && sparticuzChromium
    ? await sparticuzChromium.executablePath(CHROMIUM_REMOTE_URL)
    : process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? undefined;

  const launchArgs: string[] = isLambda && sparticuzChromium
    ? sparticuzChromium.args
    : ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'];

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: executablePath || undefined,
      args: launchArgs,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      code: 'BROWSER_LAUNCH_FAILED',
      message: `Failed to launch headless browser: ${msg}`,
    };
  }

  let screenshotBuffer: Buffer;
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      // Appear as a real desktop browser to avoid bot-detection soft-blocks
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    const page = await context.newPage();

    // ── 3. Navigate — tiered wait strategy ──────────────────────────────────
    // 'networkidle' fails on pages with persistent polling (PayPal, Stripe, etc.).
    // Strategy: try 'load' first (DOM + subresources), then fall back to
    // 'domcontentloaded' if that also times out. Either way we get a page.
    try {
      await page.goto(targetUrl, {
        waitUntil: 'load',
        timeout: 20_000, // 20 s for load event
      });
    } catch {
      // If 'load' times out (e.g. lazy scripts never finish), fall back to
      // domcontentloaded which fires as soon as the HTML is parsed.
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 25_000,
      });
    }

    // Let any lazy-loaded hero images / animations settle.
    // 2 s gives SPAs time to render their above-the-fold content.
    await page.waitForTimeout(2_000);

    // Dismiss common cookie / consent banners by pressing Escape
    await page.keyboard.press('Escape').catch(() => {/* non-fatal */ });

    // ── 4. Inject date stamp overlay ─────────────────────────────────────────
    // A fixed-position badge is injected into the live DOM so it appears
    // baked into the PNG. Styled to be legible on any background.
    await page.evaluate((label: string) => {
      const badge = document.createElement('div');
      badge.id = '__snapshot-badge__';
      badge.textContent = '📸 ' + label;
      Object.assign(badge.style, {
        position:     'fixed',
        bottom:       '16px',
        right:        '16px',
        zIndex:       '2147483647',
        background:   'rgba(0,0,0,0.72)',
        color:        '#ffffff',
        fontFamily:   '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize:     '13px',
        fontWeight:   '600',
        lineHeight:   '1',
        padding:      '8px 14px',
        borderRadius: '8px',
        backdropFilter: 'blur(4px)',
        boxShadow:    '0 2px 12px rgba(0,0,0,0.45)',
        letterSpacing: '0.01em',
        pointerEvents: 'none',
        userSelect:   'none',
      });
      document.body.appendChild(badge);
    }, snapshotLabel);

    // ── 5. Capture screenshot ────────────────────────────────────────────────
    // fullPage: false → viewport crop (1440×900) which represents the "hero"
    const rawBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    screenshotBuffer = Buffer.from(rawBuffer);
    await context.close();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await browser.close().catch(() => {/* ignore cleanup errors */ });
    return {
      status: 'error',
      code: 'NAVIGATION_FAILED',
      message: `Could not load ${targetUrl}: ${msg}`,
    };
  } finally {
    // Always close the browser even if we hit an error above
    await browser.close().catch(() => {/* ignore */ });
  }

  // ── 5. Upload screenshot to Supabase Storage ──────────────────────────────
  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    return {
      status: 'error',
      code: 'MISSING_SUPABASE_CONFIG',
      message: 'Supabase credentials are not configured on the server.',
    };
  }

  const storagePath = buildStoragePath(brandId);

  const { error: uploadError } = await supabase.storage
    .from('creative-assets')
    .upload(storagePath, screenshotBuffer, {
      contentType: 'image/png',
      upsert: true, // overwrite if same path somehow collides
    });

  if (uploadError) {
    return {
      status: 'error',
      code: 'UPLOAD_FAILED',
      message: `Storage upload failed: ${uploadError.message}`,
    };
  }

  // ── 6. Get the public URL ─────────────────────────────────────────────────
  const { data: publicUrlData } = supabase.storage
    .from('creative-assets')
    .getPublicUrl(storagePath);

  const thumbnailUrl = publicUrlData.publicUrl;

  // ── 7. Insert creative row ────────────────────────────────────────────────
  // source_url uses the timestamped snapshot URL so each scrape of the same
  // brand homepage creates a new distinct row (no duplicate constraint hits).
  const creativeInsert: CreativeInsert = {
    brand_id: brandId,
    campaign_id: campaignId ?? null,
    platform: 'landing_page',
    source_url: snapshotUrl,   // includes ?_snapshot=<ISO> for uniqueness
    thumbnail_url: thumbnailUrl,
    view_count: null,
    engagement_rate: null,
  };

  const { data: creativeRaw, error: dbError } = await supabase
    .from('creatives')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(creativeInsert as any)
    .select()
    .single();

  const creative = creativeRaw as CreativeRow | null;

  if (dbError) {
    return {
      status: 'error',
      code: 'DB_INSERT_FAILED',
      message: `Database insert failed: ${dbError.message}`,
    };
  }

  return {
    status: 'success',
    creativeId: creative?.id ?? 'unknown',
    thumbnailUrl: thumbnailUrl,
    sourceUrl: targetUrl, // return the clean URL (without snapshot param) for display
  };
}
