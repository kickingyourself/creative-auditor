/**
 * app/api/ingest/facebook/route.ts
 *
 * POST /api/ingest/facebook
 *
 * Fetches Facebook Ad creatives via the Meta Marketing API v21.0.
 *
 * Supports two modes selected by the `mode` field in the request body:
 *
 * ── MODE: "single" ──────────────────────────────────────────────────────────
 * Fetch one ad's creative by Ad ID.
 *
 * Request:
 * {
 *   mode:        "single",
 *   ad_id:       string,  // e.g. "23844567890123456"
 *   brand_id:    string,
 *   campaign_id?: string
 * }
 *
 * Response (201):
 * { creative: CreativeRow, meta: { ad_id, creative_id, name, ad_format, spend, impressions } }
 *
 * ── MODE: "account" ─────────────────────────────────────────────────────────
 * Bulk-sync the most recent N ads from an Ad Account.
 *
 * Request:
 * {
 *   mode:           "account",
 *   ad_account_id:  string,  // with or without "act_" prefix
 *   brand_id:       string,
 *   campaign_id?:   string,
 *   max_results?:   number   // 1–50, default 10
 * }
 *
 * Response (200):
 * { summary: { inserted, duplicates, errors, account_id }, results: AdIngestResult[] }
 *
 * ── Required env vars ────────────────────────────────────────────────────────
 *   META_ACCESS_TOKEN          – User or System User token with ads_read scope
 *   META_AD_ACCOUNT_ID         – Default ad account (act_XXXXXXXXXX), optional
 *
 * ── Required Meta App Permissions ───────────────────────────────────────────
 *   ads_read                   – read ads, creatives, and insights
 *   (ads_management if you also need to write)
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, CreativeInsert } from "@/types/database.types";
import { apiError, supabaseErrorCode } from "@/lib/errors";

// ─── Supabase ─────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

// ─── Meta Marketing API types ─────────────────────────────────────────────────

/**
 * Partial shape of a Marketing API AdCreative object.
 * Reference: https://developers.facebook.com/docs/marketing-api/reference/ad-creative
 */
interface AdCreative {
  id: string;
  name?: string;
  title?: string;
  body?: string;                   // primary text / ad copy
  thumbnail_url?: string;          // pre-signed CDN URL (expires ~1hr)
  image_url?: string;              // static image URL if image ad
  effective_object_story_id?: string; // page_id_post_id — for engagement lookup
  object_story_spec?: {
    page_id?: string;
    link_data?: {
      image_hash?: string;
      image_url?: string;
      video_id?: string;
      message?: string;
      name?: string;              // headline
      link?: string;
    };
    video_data?: {
      video_id?: string;
      image_url?: string;
      title?: string;
      message?: string;
    };
    photo_data?: {
      images?: Array<{ hash?: string; url?: string }>;
    };
  };
  asset_feed_spec?: {
    images?: Array<{ hash?: string; url?: string }>;
    videos?: Array<{ video_id?: string; thumbnail_url?: string }>;
  };
}

/** Partial shape of a Marketing API Ad object. */
interface AdObject {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;       // "ACTIVE" | "PAUSED" | "DELETED" | …
  created_time?: string;           // ISO-8601
  updated_time?: string;
  creative?: AdCreative;
  insights?: {
    data: Array<{
      impressions?: string;
      spend?: string;
      clicks?: string;
      reach?: string;
    }>;
  };
}

interface MarketingApiList<T> {
  data: T[];
  paging?: { cursors?: { after?: string }; next?: string };
}

interface GraphError {
  error: { message: string; type: string; code: number; error_subcode?: number; fbtrace_id?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalises an ad account ID — ensures it has the "act_" prefix. */
function normaliseAccountId(raw: string): string {
  const stripped = raw.trim().replace(/^act_/, "");
  return `act_${stripped}`;
}

/** Infers ad_type from creative fields. */
function inferAdFormat(creative: AdCreative): "video" | "image" | "carousel" {
  const spec = creative.object_story_spec;
  if (spec?.video_data || spec?.link_data?.video_id) return "video";
  const assetVideos = creative.asset_feed_spec?.videos ?? [];
  if (assetVideos.length > 0) return "video";
  const assetImages = creative.asset_feed_spec?.images ?? [];
  if (assetImages.length > 1) return "carousel";
  return "image";
}

/** Best thumbnail URL: thumbnail_url → image_url → link_data.image_url → video thumbnail → null */
function pickCreativeThumbnail(creative: AdCreative): string | null {
  return (
    creative.thumbnail_url ??
    creative.image_url ??
    creative.object_story_spec?.link_data?.image_url ??
    creative.object_story_spec?.video_data?.image_url ??
    creative.asset_feed_spec?.videos?.[0]?.thumbnail_url ??
    null
  );
}

/** Best ad copy preview: body → title → name → null */
function pickAdLabel(creative: AdCreative, ad: AdObject): string {
  return (
    creative.body?.slice(0, 120) ??
    creative.title ??
    creative.name ??
    ad.name ??
    "Facebook Ad"
  );
}

/** Canonical ad permalink (Facebook Ads Library URL). */
function adPermalink(adId: string): string {
  return `https://www.facebook.com/ads/library/?id=${adId}`;
}

/** Parses a numeric string from the API safely. */
function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/** Handles GraphError payloads uniformly, returns an apiError Response or null. */
function handleGraphError(json: unknown): Response | null {
  if (json && typeof json === "object" && "error" in json) {
    const err = (json as GraphError).error;
    if (err.code === 4 || err.code === 32 || err.code === 17 || err.code === 80000) {
      return apiError("UPSTREAM_RATE_LIMIT", err.message);
    }
    if (err.code === 190 || err.code === 102) {
      return apiError(
        "MISSING_API_KEY",
        `META_ACCESS_TOKEN is invalid or expired: ${err.message}`
      );
    }
    if (err.code === 200 || err.code === 273) {
      return apiError(
        "MISSING_API_KEY",
        `Permission denied — ensure your token has ads_read scope: ${err.message}`
      );
    }
    if (err.code === 100 && err.error_subcode === 33) {
      return apiError("VIDEO_NOT_FOUND", `Ad not found: ${err.message}`);
    }
    return apiError("UPSTREAM_ERROR", `Meta Marketing API error ${err.code}: ${err.message}`);
  }
  return null;
}

/** Fields to request from the Marketing API for each ad. */
const AD_FIELDS = [
  "id",
  "name",
  "status",
  "effective_status",
  "created_time",
  "creative{id,name,title,body,thumbnail_url,image_url,effective_object_story_id,object_story_spec,asset_feed_spec}",
  "insights.date_preset(last_30d){impressions,spend,clicks,reach}",
].join(",");

// ─── Single-ad fetch ──────────────────────────────────────────────────────────

async function fetchSingleAd(adId: string, accessToken: string): Promise<AdObject | Response> {
  const url = new URL(`https://graph.facebook.com/v21.0/${adId}`);
  url.searchParams.set("fields", AD_FIELDS);
  url.searchParams.set("access_token", accessToken);

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    const json = await res.json();
    const errResponse = handleGraphError(json);
    if (errResponse) return errResponse;
    if (!res.ok) return apiError("UPSTREAM_ERROR", `Meta API returned HTTP ${res.status}`);
    return json as AdObject;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError("UPSTREAM_ERROR", `Network error: ${msg}`);
  }
}

// ─── Account bulk fetch ───────────────────────────────────────────────────────

async function fetchAccountAds(
  accountId: string,
  accessToken: string,
  limit: number
): Promise<AdObject[] | Response> {
  const url = new URL(`https://graph.facebook.com/v21.0/${accountId}/ads`);
  url.searchParams.set("fields", AD_FIELDS);
  url.searchParams.set("limit", String(Math.min(limit, 50)));
  url.searchParams.set("sort", "created_time_descending");
  url.searchParams.set("access_token", accessToken);

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    const json = await res.json();
    const errResponse = handleGraphError(json);
    if (errResponse) return errResponse;
    if (!res.ok) return apiError("UPSTREAM_ERROR", `Meta API returned HTTP ${res.status}`);
    const list = json as MarketingApiList<AdObject>;
    return list.data ?? [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError("UPSTREAM_ERROR", `Network error: ${msg}`);
  }
}

// ─── Transform ad → CreativeInsert ────────────────────────────────────────────

function buildCreativeInsert(
  ad: AdObject,
  brandId: string,
  campaignId: string | null
): CreativeInsert {
  const creative = ad.creative ?? ({ id: ad.id } as AdCreative);
  const insight = ad.insights?.data?.[0];
  const impressions = parseNum(insight?.impressions);
  const reach = parseNum(insight?.reach);
  const clicks = parseNum(insight?.clicks);

  // engagement_rate = clicks / impressions (CTR proxy) — real engagement not available for dark ads
  const engagement_rate =
    impressions && impressions > 0 && clicks != null
      ? Math.min(clicks / impressions, 1)
      : null;

  return {
    brand_id: brandId,
    campaign_id: campaignId,
    platform: "social" as const,
    source_url: adPermalink(ad.id),
    thumbnail_url: pickCreativeThumbnail(creative),
    view_count: reach ?? impressions,
    engagement_rate,
  };
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

type RequestBody =
  | { mode: "single"; ad_id?: unknown; brand_id?: unknown; campaign_id?: unknown }
  | { mode: "account"; ad_account_id?: unknown; brand_id?: unknown; campaign_id?: unknown; max_results?: unknown }
  | { mode?: unknown; brand_id?: unknown };

export async function POST(request: Request): Promise<Response> {
  // ── 1. Parse body ───────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON.");
  }

  const mode = (body as { mode?: unknown }).mode;
  if (mode !== "single" && mode !== "account") {
    return apiError(
      "MISSING_BODY_FIELD",
      "Field 'mode' must be either \"single\" (one ad by ID) or \"account\" (bulk from ad account)."
    );
  }

  const brand_id = (body as { brand_id?: unknown }).brand_id;
  if (typeof brand_id !== "string" || !brand_id.trim()) {
    return apiError("MISSING_BODY_FIELD", "Field 'brand_id' is required.");
  }
  const campaignId =
    typeof (body as { campaign_id?: unknown }).campaign_id === "string" &&
    ((body as { campaign_id?: unknown }).campaign_id as string).trim()
      ? ((body as { campaign_id?: unknown }).campaign_id as string).trim()
      : null;

  // ── 2. Validate token ───────────────────────────────────────────────────────
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    return apiError("MISSING_API_KEY", "META_ACCESS_TOKEN is not configured on the server.");
  }

  // ── 3. Supabase client ──────────────────────────────────────────────────────
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    return apiError("MISSING_API_KEY", "Supabase credentials are not configured on the server.");
  }

  // ══ SINGLE MODE ════════════════════════════════════════════════════════════

  if (mode === "single") {
    const singleBody = body as { mode: "single"; ad_id?: unknown; brand_id?: unknown; campaign_id?: unknown };
    if (typeof singleBody.ad_id !== "string" || !singleBody.ad_id.trim()) {
      return apiError("MISSING_BODY_FIELD", "Field 'ad_id' is required in single mode.");
    }
    const adId = singleBody.ad_id.trim();

    const adOrError = await fetchSingleAd(adId, accessToken);
    if (adOrError instanceof Response) return adOrError;
    const ad = adOrError;

    if (!ad?.id) {
      return apiError("VIDEO_NOT_FOUND", `No ad found with ID: ${adId}`);
    }

    const insert = buildCreativeInsert(ad, brand_id, campaignId);
    const { data: creative, error: dbError } = await supabase
      .from("creatives")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insert as any)
      .select()
      .single();

    if (dbError) {
      const pgError = dbError as unknown as { code?: string; message: string };
      return apiError(supabaseErrorCode(pgError.code), pgError.message);
    }

    const creativeObj = ad.creative ?? ({ id: ad.id } as AdCreative);
    return Response.json(
      {
        creative,
        meta: {
          ad_id: ad.id,
          creative_id: creativeObj.id,
          name: pickAdLabel(creativeObj, ad),
          ad_format: inferAdFormat(creativeObj),
          effective_status: ad.effective_status ?? ad.status,
          created_time: ad.created_time,
          impressions: parseNum(ad.insights?.data?.[0]?.impressions),
          spend: ad.insights?.data?.[0]?.spend ?? null,
          reach: parseNum(ad.insights?.data?.[0]?.reach),
        },
      },
      { status: 201 }
    );
  }

  // ══ ACCOUNT MODE ═══════════════════════════════════════════════════════════

  const accountBody = body as { mode: "account"; ad_account_id?: unknown; brand_id?: unknown; campaign_id?: unknown; max_results?: unknown };

  // Resolve ad account ID — request body takes priority over env var
  const rawAccountId =
    typeof accountBody.ad_account_id === "string" && accountBody.ad_account_id.trim()
      ? accountBody.ad_account_id.trim()
      : (process.env.META_AD_ACCOUNT_ID ?? "");

  if (!rawAccountId) {
    return apiError(
      "MISSING_BODY_FIELD",
      "Field 'ad_account_id' is required in account mode (or set META_AD_ACCOUNT_ID env var)."
    );
  }

  const accountId = normaliseAccountId(rawAccountId);
  const maxResults = typeof accountBody.max_results === "number"
    ? Math.max(1, Math.min(accountBody.max_results, 50))
    : 10;

  const adsOrError = await fetchAccountAds(accountId, accessToken, maxResults);
  if (adsOrError instanceof Response) return adsOrError;
  const ads = adsOrError;

  if (ads.length === 0) {
    return Response.json({
      summary: { inserted: 0, duplicates: 0, errors: 0, account_id: accountId },
      results: [],
    });
  }

  // Process each ad — upsert individually so partial failures don't block others
  type AdResult = {
    status: "inserted" | "duplicate" | "error";
    ad_id: string;
    name: string;
    thumbnail_url: string | null;
    ad_format: string;
    impressions: number | null;
    creative_id?: string;
    error?: string;
  };

  const results: AdResult[] = [];
  let inserted = 0;
  let duplicates = 0;
  let errors = 0;

  for (const ad of ads) {
    const creativeObj = ad.creative ?? ({ id: ad.id } as AdCreative);
    const label = pickAdLabel(creativeObj, ad);
    const format = inferAdFormat(creativeObj);
    const thumb = pickCreativeThumbnail(creativeObj);

    const insert = buildCreativeInsert(ad, brand_id, campaignId);
    const { data: creative, error: dbError } = await supabase
      .from("creatives")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insert as any)
      .select()
      .single();

    if (dbError) {
      const pgError = dbError as unknown as { code?: string; message: string };
      const errCode = supabaseErrorCode(pgError.code);
      if (errCode === "DUPLICATE_CREATIVE") {
        duplicates++;
        results.push({ status: "duplicate", ad_id: ad.id, name: label, thumbnail_url: thumb, ad_format: format, impressions: null });
      } else {
        errors++;
        results.push({ status: "error", ad_id: ad.id, name: label, thumbnail_url: thumb, ad_format: format, impressions: null, error: pgError.message });
      }
    } else {
      inserted++;
      const row = creative as { id: string } | null;
      results.push({
        status: "inserted",
        ad_id: ad.id,
        creative_id: row?.id,
        name: label,
        thumbnail_url: thumb,
        ad_format: format,
        impressions: parseNum(ad.insights?.data?.[0]?.impressions),
      });
    }
  }

  return Response.json(
    {
      summary: { inserted, duplicates, errors, account_id: accountId, total_fetched: ads.length },
      results,
    },
    { status: 200 }
  );
}
