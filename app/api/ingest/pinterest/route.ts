/**
 * app/api/ingest/pinterest/route.ts
 *
 * POST /api/ingest/pinterest
 *
 * Accepts a Pinterest pin URL, fetches metadata via Pinterest's public
 * oEmbed endpoint (no API key required for public pins), and upserts a row
 * into the `creatives` Supabase table.
 *
 * Request body (JSON):
 * {
 *   "url":         string,   // Pinterest pin URL
 *   "brand_id":    string,   // UUID of the owning brand
 *   "campaign_id": string?   // Optional UUID of a campaign
 * }
 *
 * Success (201): { creative, meta: { title, author, thumbnail_url } }
 * Errors: 400 MISSING_BODY_FIELD · 422 INVALID_URL · 404 PIN_NOT_FOUND
 *         502 UPSTREAM_ERROR · 409 DUPLICATE_CREATIVE · 500 SUPABASE_*
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { CreativeInsert } from "@/types/database.types";
import { apiError, supabaseErrorCode } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

// Pinterest oEmbed response (partial)
interface PinterestOEmbed {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html?: string;
  provider_name?: string;
}

/** Validate + normalise a Pinterest pin URL */
function normalisePinterestUrl(raw: string): string | null {
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const validHosts = ["pinterest.com", "www.pinterest.com", "pin.it"];
    if (!validHosts.some(h => url.hostname === h)) return null;
    // pin.it short-links are fine; pinterest.com/pin/<ID>/ is canonical
    return url.toString();
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  // 1. Parse body
  let body: { url?: unknown; brand_id?: unknown; campaign_id?: unknown };
  try { body = await request.json(); }
  catch { return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON."); }

  const { url, brand_id, campaign_id } = body;

  if (typeof url !== "string" || !url.trim())
    return apiError("MISSING_BODY_FIELD", "'url' is required.");
  if (typeof brand_id !== "string" || !brand_id.trim())
    return apiError("MISSING_BODY_FIELD", "'brand_id' is required.");

  // 2. Validate URL
  const canonicalUrl = normalisePinterestUrl(url.trim());
  if (!canonicalUrl)
    return apiError("INVALID_URL", `Not a valid Pinterest URL: ${url}`);

  // 3. Fetch Pinterest oEmbed (public endpoint, no key needed)
  const oEmbedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(canonicalUrl)}`;
  let meta: PinterestOEmbed;
  try {
    const res = await fetch(oEmbedUrl, {
      headers: { "User-Agent": "CreativeAudit/1.0" },
    });
    if (res.status === 404)
      return apiError("PIN_NOT_FOUND", `No public Pinterest pin found at: ${canonicalUrl}`);
    if (!res.ok)
      return apiError("UPSTREAM_ERROR", `Pinterest oEmbed responded with ${res.status}`);
    meta = (await res.json()) as PinterestOEmbed;
  } catch (err) {
    return apiError("UPSTREAM_ERROR", `Network error contacting Pinterest: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Build creative row
  const creativeInsert: CreativeInsert = {
    brand_id:        brand_id as string,
    campaign_id:     typeof campaign_id === "string" && campaign_id.trim() ? campaign_id.trim() : null,
    platform:        "pinterest" as const,
    source_url:      canonicalUrl,
    thumbnail_url:   meta.thumbnail_url ?? null,
    view_count:      null,
    engagement_rate: null,
  };

  // 5. Upsert into Supabase
  let supabase;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const { data: creative, error: dbError } = await supabase
    .from("creatives")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(creativeInsert as any)
    .select()
    .single();

  if (dbError) {
    const pgError = dbError as unknown as { code?: string; message: string };
    return apiError(supabaseErrorCode(pgError.code), pgError.message);
  }

  return Response.json({
    creative,
    meta: {
      title:         meta.title ?? null,
      author:        meta.author_name ?? null,
      thumbnail_url: meta.thumbnail_url ?? null,
      pin_url:       canonicalUrl,
    },
  }, { status: 201 });
}
