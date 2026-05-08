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

import { chromium } from 'playwright-core';
import sparticuzChromium from '@sparticuz/chromium';
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
  const rawUrl     = (formData.get('url') as string | null) ?? '';
  const rawBrandId = (formData.get('brand_id') as string | null) ?? '';
  const brandId    = toUuidOrNull(rawBrandId);
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

  // ── 2. Launch headless Chromium ────────────────────────────────────────────
  // On Vercel/Lambda: @sparticuz/chromium provides a compressed binary that
  // extracts to /tmp. Locally: falls back to playwright-core's bundled browser.
  const isLambda =
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.VERCEL ||
    process.env.NODE_ENV === 'production';

  const executablePath = isLambda
    ? await sparticuzChromium.executablePath()
    : process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? undefined;

  const launchArgs = isLambda
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

    // ── 3. Navigate and wait for network to settle ───────────────────────────
    await page.goto(targetUrl, {
      waitUntil: 'networkidle',
      timeout: 30_000, // 30 s hard cap
    });

    // Let any lazy-loaded hero images / animations finish
    await page.waitForTimeout(1500);

    // Dismiss common cookie / consent banners by pressing Escape
    await page.keyboard.press('Escape').catch(() => {/* non-fatal */});

    // ── 4. Capture screenshot ────────────────────────────────────────────────
    // fullPage: false → viewport crop (1440×900) which represents the "hero"
    // Set to true if you want the entire scrollable page
    const rawBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    screenshotBuffer = Buffer.from(rawBuffer);
    await context.close();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await browser.close().catch(() => {/* ignore cleanup errors */});
    return {
      status: 'error',
      code: 'NAVIGATION_FAILED',
      message: `Could not load ${targetUrl}: ${msg}`,
    };
  } finally {
    // Always close the browser even if we hit an error above
    await browser.close().catch(() => {/* ignore */});
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
  const creativeInsert: CreativeInsert = {
    brand_id:       brandId,
    campaign_id:    campaignId ?? null,
    platform:       'homepage',
    source_url:     targetUrl,
    thumbnail_url:  thumbnailUrl,
    view_count:     null,
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
    // Unique violation → already scraped this URL for this brand
    if ((dbError as unknown as { code?: string }).code === '23505') {
      return {
        status: 'error',
        code: 'DUPLICATE_CREATIVE',
        message: `A creative for "${targetUrl}" already exists for this brand.`,
      };
    }
    return {
      status: 'error',
      code: 'DB_INSERT_FAILED',
      message: `Database insert failed: ${dbError.message}`,
    };
  }

  return {
    status: 'success',
    creativeId:   creative?.id ?? 'unknown',
    thumbnailUrl: thumbnailUrl,
    sourceUrl:    targetUrl,
  };
}
