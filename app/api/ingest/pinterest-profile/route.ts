/**
 * app/api/ingest/pinterest-profile/route.ts
 *
 * POST /api/ingest/pinterest-profile
 *
 * Scrapes a Pinterest brand profile page to extract pin URLs, then fetches
 * each pin's metadata via Pinterest's public oEmbed endpoint (no API key
 * needed) and upserts creatives into Supabase.
 *
 * Strategy: Pinterest renders an initial JSON payload inside a <script> tag
 * (`__PWS_DATA__`) that contains the first batch of pins. We extract pin IDs
 * from that JSON without needing a headless browser.
 *
 * Request body (JSON):
 * {
 *   "profile_url": string,    // e.g. "https://pinterest.com/nike"
 *   "brand_id":    string,    // UUID
 *   "campaign_id": string?,   // optional UUID
 *   "max_results": number?    // 1–50, default 15
 * }
 *
 * Success (200):
 * { summary: { inserted, duplicates, errors, profile, max_results }, results: PinResult[] }
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, CreativeInsert } from "@/types/database.types";
import { apiError, supabaseErrorCode } from "@/lib/errors";

// ── Supabase ──────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

// ── UUID guard ────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toUuidOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

// ── Browser-like headers ──────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
};

// ── Profile URL validation ────────────────────────────────────────────────────

const PINTEREST_HOSTS = [
  "pinterest.com", "www.pinterest.com",
  "pinterest.co.uk", "pinterest.fr", "pinterest.de",
  "pinterest.es", "pinterest.com.au", "pinterest.ca", "pinterest.jp",
];

function normaliseProfileUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
    if (!PINTEREST_HOSTS.includes(url.hostname)) return null;
    // Strip to just the pathname (no query params)
    const pathname = url.pathname.replace(/\/$/, ""); // remove trailing slash
    // Profile paths look like /username or /username/boards etc.
    // We want the canonical profile root: /username/
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    // Reject pin URLs
    if (parts[0] === "pin") return null;
    return `https://www.pinterest.com/${parts[0]}/`;
  } catch {
    return null;
  }
}

// ── Pin ID extraction from HTML ───────────────────────────────────────────────

/**
 * Pinterest embeds initial page state as a JSON blob in a <script> tag with
 * the id "__PWS_DATA__". We extract pin IDs from this blob.
 * Fallback: regex-scan the raw HTML for /pin/{ID}/ patterns.
 */
function extractPinIds(html: string, maxResults: number): string[] {
  const ids = new Set<string>();

  // Strategy 1: extract from __PWS_DATA__ JSON
  const pwsMatch = html.match(/<script\s+id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (pwsMatch?.[1]) {
    try {
      const json = JSON.parse(pwsMatch[1]);
      // Walk the JSON and collect any numeric keys that look like pin IDs
      const jsonStr = JSON.stringify(json);
      const idMatches = jsonStr.matchAll(/"id"\s*:\s*"(\d{10,20})"/g);
      for (const m of idMatches) {
        ids.add(m[1]);
        if (ids.size >= maxResults * 3) break; // collect extra, filter later
      }
    } catch { /* fall through to strategy 2 */ }
  }

  // Strategy 2: regex over the full HTML for /pin/{ID}/ href patterns
  const hrefMatches = html.matchAll(/\/pin\/(\d{10,20})\//g);
  for (const m of hrefMatches) {
    ids.add(m[1]);
    if (ids.size >= maxResults * 3) break;
  }

  return Array.from(ids).slice(0, maxResults);
}

// ── oEmbed fetch ──────────────────────────────────────────────────────────────

interface PinterestOEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
  error?: string;
}

async function fetchOEmbed(pinUrl: string): Promise<PinterestOEmbed | null> {
  try {
    const res = await fetch(
      `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(pinUrl)}`,
      { headers: { "User-Agent": BROWSER_HEADERS["User-Agent"] } }
    );
    if (!res.ok) return null;
    return res.json() as Promise<PinterestOEmbed>;
  } catch {
    return null;
  }
}

// ── Result types ──────────────────────────────────────────────────────────────

type PinResult =
  | { status: "inserted";  source_url: string; creative_id: string; thumbnail_url: string | null; title: string | null }
  | { status: "duplicate"; source_url: string; title: string | null }
  | { status: "error";     source_url: string; title: string | null; error: string };

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // 1. Parse body
  let body: { profile_url?: unknown; brand_id?: unknown; campaign_id?: unknown; max_results?: unknown };
  try { body = await request.json(); }
  catch { return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON."); }

  const { profile_url, brand_id, campaign_id, max_results } = body;

  if (typeof profile_url !== "string" || !profile_url.trim())
    return apiError("MISSING_BODY_FIELD", "Field 'profile_url' is required.");
  if (typeof brand_id !== "string" || !brand_id.trim())
    return apiError("MISSING_BODY_FIELD", "Field 'brand_id' is required.");

  const brandId    = brand_id.trim();
  const campaignId = toUuidOrNull(typeof campaign_id === "string" ? campaign_id : null);
  const maxResults = Math.min(Math.max(typeof max_results === "number" ? max_results : 15, 1), 50);

  // 2. Validate + normalise profile URL
  const profileUrl = normaliseProfileUrl(profile_url.trim());
  if (!profileUrl)
    return apiError("INVALID_URL", `Could not parse a Pinterest profile URL from: ${profile_url}. Expected format: pinterest.com/brandname`);

  // 3. Scrape the profile page
  let html: string;
  try {
    const res = await fetch(profileUrl, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    if (res.status === 404)
      return apiError("PROFILE_NOT_FOUND", `No Pinterest profile found at: ${profileUrl}`);
    if (!res.ok)
      return apiError("UPSTREAM_ERROR", `Pinterest responded with HTTP ${res.status} for: ${profileUrl}`);
    html = await res.text();
  } catch (err) {
    return apiError("UPSTREAM_ERROR", `Could not fetch profile page: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Extract pin IDs
  const pinIds = extractPinIds(html, maxResults);
  if (pinIds.length === 0)
    return apiError("NO_PINS_FOUND", `No pins could be extracted from ${profileUrl}. The profile may be private or Pinterest may be blocking automated access.`);

  // 5. Resolve profile handle for the summary
  const profileHandle = profileUrl.replace("https://www.pinterest.com/", "").replace("/", "");

  // 6. Fetch oEmbed + insert for each pin
  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const results: PinResult[] = [];

  for (const pinId of pinIds) {
    const pinUrl = `https://www.pinterest.com/pin/${pinId}/`;

    // Fetch oEmbed (non-fatal if it fails — we still insert with null metadata)
    const meta = await fetchOEmbed(pinUrl);

    const insert: CreativeInsert = {
      brand_id:        brandId,
      campaign_id:     campaignId,
      platform:        "pinterest",
      source_url:      pinUrl,
      title:           meta?.title ?? null,
      thumbnail_url:   meta?.thumbnail_url ?? null,
      view_count:      null,
      engagement_rate: null,
    };

    const { data: creative, error: dbError } = await supabase
      .from("creatives")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insert as any)
      .select("id, thumbnail_url")
      .single();

    if (dbError) {
      const pgError = dbError as unknown as { code?: string; message: string };
      if (pgError.code === "23505") {
        results.push({ status: "duplicate", source_url: pinUrl, title: meta?.title ?? null });
      } else {
        results.push({ status: "error", source_url: pinUrl, title: meta?.title ?? null, error: supabaseErrorCode(pgError.code) + ": " + pgError.message });
      }
    } else {
      results.push({
        status:        "inserted",
        source_url:    pinUrl,
        creative_id:   (creative as { id: string }).id,
        thumbnail_url: (creative as { thumbnail_url: string | null }).thumbnail_url,
        title:         meta?.title ?? null,
      });
    }
  }

  // 7. Summary
  const summary = {
    inserted:    results.filter(r => r.status === "inserted").length,
    duplicates:  results.filter(r => r.status === "duplicate").length,
    errors:      results.filter(r => r.status === "error").length,
    profile:     profileHandle,
    max_results: maxResults,
  };

  return Response.json({ summary, results }, { status: 200 });
}
