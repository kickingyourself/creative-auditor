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
    const stealthArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      // Remove automation indicators that bot detectors look for
      '--disable-blink-features=AutomationControlled',
      // Mimic a real desktop Chrome install
      '--disable-infobars',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-features=TranslateUI',
      // Needed for proper rendering in headless
      '--hide-scrollbars',
      '--mute-audio',
      '--window-size=1440,900',
    ];
    browser = await chromium.launch({
      headless: true,
      executablePath: executablePath || undefined,
      args: isLambda && sparticuzChromium ? sparticuzChromium.args : stealthArgs,
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
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      // Realistic HTTP request headers that match the UA
      extraHTTPHeaders: {
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest':  'document',
        'Sec-Fetch-Mode':  'navigate',
        'Sec-Fetch-Site':  'none',
        'Sec-Fetch-User':  '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    const page = await context.newPage();

    // ── Stealth patches (run before any page script) ───────────────────────────
    // Akamai Bot Manager, Cloudflare, and similar WAFs fingerprint the browser
    // via JS properties that headless Chrome exposes. Patching them here makes
    // the browser indistinguishable from a real Chrome desktop session.
    await page.addInitScript(() => {
      // 1. Remove the primary automation signal
      Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });

      // 2. Add window.chrome — absent in headless, checked by Akamai
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).chrome = {
        runtime:  {},
        loadTimes: () => ({}),
        csi:       () => ({}),
        app:       {},
      };

      // 3. Fake a realistic plugins list (headless has 0)
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const arr = [
            { name: 'Chrome PDF Plugin',     filename: 'internal-pdf-viewer',   description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer',     filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client',         filename: 'internal-nacl-plugin',  description: '' },
          ];
          Object.setPrototypeOf(arr, PluginArray.prototype);
          return arr;
        },
        configurable: true,
      });

      // 4. Realistic languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-GB', 'en'],
        configurable: true,
      });

      // 5. Permissions API — headless returns 'denied' for notifications, real browsers 'default'
      const origQuery = window.navigator.permissions.query.bind(navigator.permissions);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator.permissions as any).query = (params: any) =>
        params?.name === 'notifications'
          ? Promise.resolve({ state: 'default' } as unknown as PermissionStatus)
          : origQuery(params);

      // 6. Hide automation-related iframe content-window properties
      // (some Akamai checks iterate iframes looking for webdriver)
      const origFn = HTMLIFrameElement.prototype.contentWindow;
      if (origFn) {
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
          get() {
            const win = origFn;
            if (win) {
              try {
                Object.defineProperty((win as unknown as Window), 'webdriver', { get: () => false });
              } catch { /* cross-origin — ignore */ }
            }
            return win;
          },
          configurable: true,
        });
      }
    });

    // ── 3a. Block fonts, consent managers, analytics ─────────────────────────
    // • Fonts:   screenshot() waits for font loads — blocking skips that wait.
    // • Consent: blocking OneTrust / Cookiebot CDNs prevents the banner script
    //            from loading at all (most reliable suppression technique).
    // • Analytics/ads: removes persistent polling that slows networkidle.
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      const url  = route.request().url();
      const blockUrl = (
        // Consent managers
        url.includes('cdn.cookielaw.org')     ||  // OneTrust
        url.includes('cookiebot.com')         ||  // Cookiebot
        url.includes('cookie-script.com')     ||  // Cookie Script
        url.includes('consent.cookiefirst')   ||  // CookieFirst
        url.includes('trustarc.com')          ||  // TrustArc
        url.includes('usercentrics.eu')       ||  // Usercentrics
        url.includes('didomi.io')             ||  // Didomi
        url.includes('quantcast.com')         ||  // Quantcast CMP
        // Analytics / ads
        url.includes('google-analytics')      ||
        url.includes('googletagmanager')      ||
        url.includes('doubleclick.net')       ||
        url.includes('facebook.net')          ||
        url.includes('hotjar.com')            ||
        url.includes('segment.io')            ||
        url.includes('optimizely')
      );
      if (type === 'font' || type === 'media' || blockUrl) {
        route.abort().catch(() => {/* non-fatal */});
      } else {
        route.continue().catch(() => {/* non-fatal */});
      }
    });

    // ── 3b. Pre-populate consent flags before any page script runs ───────────
    // Many consent managers check localStorage / cookies on init. Setting
    // recognised keys here causes them to silently skip showing the banner.
    await page.addInitScript(() => {
      // OneTrust
      try { localStorage.setItem('OptanonAlertBoxClosed', new Date().toISOString()); } catch {}
      try { localStorage.setItem('OptanonConsent', 'isGpcEnabled=0&landingPath=NotLandingPage&groups=C0001%3A1%2CC0002%3A1%2CC0003%3A1%2CC0004%3A1'); } catch {}
      // Cookiebot
      try { localStorage.setItem('CookieConsent', JSON.stringify({ necessary: true, preferences: true, statistics: true, marketing: true })); } catch {}
      // Generic keys used by many home-rolled banners
      try { localStorage.setItem('cookieConsent',    'true'); } catch {}
      try { localStorage.setItem('cookie_consent',   'true'); } catch {}
      try { localStorage.setItem('gdprConsent',      'true'); } catch {}
      try { localStorage.setItem('gdpr_consent',     'true'); } catch {}
      try { localStorage.setItem('consent_given',    'true'); } catch {}
      try { localStorage.setItem('cookies_accepted', 'true'); } catch {}
      try { localStorage.setItem('hasSeenCookieBanner', 'true'); } catch {}
      // Set a permissive cookie as well (covers cookie-only implementations)
      document.cookie = 'cookieconsent_status=dismiss; path=/; max-age=31536000';
      document.cookie = 'cookie_consent=true; path=/; max-age=31536000';
      document.cookie = 'OptanonAlertBoxClosed=' + new Date().toISOString() + '; path=/; max-age=31536000';
    });

    // ── 3c. Navigate — tiered wait strategy ──────────────────────────────────
    try {
      await page.goto(targetUrl, { waitUntil: 'load', timeout: 20_000 });
    } catch {
      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
      } catch (navErr) {
        throw navErr;
      }
    }

    // Short settle so SPAs render above-the-fold content
    await page.waitForTimeout(1_500);

    // ── 3d. Dismiss any surviving popups / overlays ───────────────────────────
    // Layer 1 — CSS: force-hide common modal/overlay/cookie patterns.
    // This catches any banner whose script wasn't blocked and whose localStorage
    // key we didn't pre-populate.
    await page.addStyleTag({ content: `
      /* ── Force-hide common popup / overlay patterns ── */
      [class*="cookie" i], [id*="cookie" i],
      [class*="consent" i], [id*="consent" i],
      [class*="gdpr" i], [id*="gdpr" i],
      [class*="modal" i]:not(#__snapshot-badge__),
      [class*="overlay" i]:not(#__snapshot-badge__),
      [class*="popup" i]:not(#__snapshot-badge__),
      [class*="banner" i]:not([class*="hero" i]):not([class*="header" i]):not(#__snapshot-badge__),
      [class*="dialog" i]:not(#__snapshot-badge__),
      /* Named vendor selectors */
      #onetrust-banner-sdk, #onetrust-consent-sdk, #onetrust-pc-sdk,
      .cc-window, .cc-banner, #cookiebanner, .cookie-notice,
      #cookie-law-info-bar, .cookie-law-info-bar,
      #CybotCookiebotDialog, .CybotCookiebotDialogBodyButton,
      #usercentrics-root, .uc-banner,
      #didomi-host, .didomi-popup,
      [data-cookiebanner], [data-cookie-consent],
      .qc-cmp2-container, .qc-cmp-ui-container,
      /* Fixed/sticky full-screen backdrops */
      body > div[style*="position: fixed"][style*="z-index"],
      body > div[style*="position:fixed"][style*="z-index"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      /* Restore body scroll if a modal locked it */
      html, body { overflow: auto !important; }
    ` }).catch(() => {/* non-fatal */});

    // Layer 2 — Click common close / accept buttons (with short per-button timeout)
    const closeSelectors = [
      // Accept / agree buttons
      '#onetrust-accept-btn-handler',
      '.cc-accept', '.cc-dismiss', '.cc-btn.cc-allow',
      '[data-testid="accept-button"]',
      '[data-testid="cookie-accept"]',
      'button[id*="accept" i]', 'button[class*="accept" i]',
      'button[id*="agree" i]',  'button[class*="agree" i]',
      // Close / dismiss buttons
      'button[aria-label*="close" i]',
      'button[aria-label*="dismiss" i]',
      'button[aria-label*="reject" i]',
      '[class*="close-button" i]', '[class*="close_button" i]',
      '[id*="close-button" i]',
      '[data-dismiss="modal"]',
      '.modal-close', '.popup-close', '.dialog-close',
    ];
    for (const sel of closeSelectors) {
      await page.click(sel, { timeout: 400 }).catch(() => {/* element absent — skip */});
    }

    // Layer 3 — Escape key (closes native <dialog> elements and many JS modals)
    await page.keyboard.press('Escape').catch(() => {/* non-fatal */});

    // Short pause after dismissals
    await page.waitForTimeout(500);

    // ── 3e. Simulate minimal user interaction ─────────────────────────────────
    // Some WAFs (Akamai, PerimeterX) detect zero scroll/mouse activity as a bot
    // signal. A short scroll-down then back is enough to pass these heuristics.
    await page.mouse.move(720, 450).catch(() => {});
    await page.mouse.wheel(0, 300).catch(() => {});
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, -300).catch(() => {});
    await page.waitForTimeout(200);

    // ── 3f. Bot-wall detection ────────────────────────────────────────────────
    // If the site blocked us (Access Denied, CAPTCHA, rate-limit), the page
    // title or body text will indicate it. Fail early rather than uploading a
    // blank/block page as a creative.
    const botWallDetected = await page.evaluate(() => {
      const title = (document.title ?? '').toLowerCase();
      const body  = (document.body?.innerText ?? '').slice(0, 500).toLowerCase();
      const botPhrases = [
        'access denied', 'blocked', 'captcha', 'are you human',
        'bot detected', 'security check', 'ddos protection', 'unusual traffic',
        'please verify', 'cf-chl', 'ray id',
      ];
      return botPhrases.some(p => title.includes(p) || body.includes(p));
    });

    if (botWallDetected) {
      const pageTitle = await page.title().catch(() => '');
      throw new Error(`Bot-wall detected on ${targetUrl} — page title: "${pageTitle}". The site is blocking automated access.`);
    }

    // ── 4. Inject date stamp overlay ─────────────────────────────────────────
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
    const rawBuffer = await page.screenshot({
      type:     'png',
      fullPage: false,
      clip:     { x: 0, y: 0, width: 1440, height: 900 },
      timeout:  45_000,
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
    platform: 'homepage',
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
