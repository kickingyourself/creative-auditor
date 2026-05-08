/**
 * app/api/ingest/instagram/route.ts
 *
 * POST /api/ingest/instagram
 *
 * Accepts an Instagram post URL (or shortcode), fetches metadata via the
 * Instagram Graph API (requires a connected Instagram Business/Creator account
 * via Meta Business Suite), and upserts a row into the `creatives` table.
 *
 * Request body (JSON):
 * {
 *   "url":         string,   // e.g. https://www.instagram.com/p/ABC123xyz/
 *   "brand_id":    string,   // UUID of the owning brand
 *   "campaign_id": string?   // Optional UUID of a campaign
 *   "ig_user_id":  string?   // Optional IG Business Account user ID override
 * }
 *
 * Required env vars:
 *   META_ACCESS_TOKEN  – User or Page token with instagram_basic,
 *                        instagram_manage_insights, pages_show_list scopes
 *   INSTAGRAM_BUSINESS_ACCOUNT_ID – the IG Business Account ID to search within
 *
 * Supported URL formats:
 *   https://www.instagram.com/p/<SHORTCODE>/
 *   https://www.instagram.com/reel/<SHORTCODE>/
 *   https://www.instagram.com/tv/<SHORTCODE>/
 *
 * The Instagram Graph API does NOT support fetching arbitrary public posts
 * by URL — you can only fetch media owned by the authenticated business
 * account. This route looks up the shortcode inside the configured
 * business account's media library.
 *
 * Success response (201):
 * { creative: CreativeRow, meta: { media_id, shortcode, caption_preview, media_type, timestamp } }
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

// ─── Instagram Graph API types ─────────────────────────────────────────────────

type IGMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";

interface IGMedia {
  id: string;
  shortcode: string;
  media_type: IGMediaType;
  media_url?: string;          // direct asset URL (not always present for video)
  thumbnail_url?: string;      // video thumbnail
  permalink: string;
  timestamp: string;           // ISO-8601
  caption?: string;
  like_count?: number;
  comments_count?: number;
  // insights are fetched in a separate sub-request
  insights?: {
    data: Array<{ name: string; values: Array<{ value: number }>; period: string; title?: string }>;
  };
}

interface IGMediaList {
  data: IGMedia[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
}

interface IGInsightItem {
  name: string;
  period: string;
  values: Array<{ value: number; end_time?: string }>;
  id: string;
}

interface IGInsightsResponse {
  data: IGInsightItem[];
}

interface GraphError {
  error: { message: string; type: string; code: number; fbtrace_id?: string };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extracts the shortcode from an Instagram URL.
 *
 * Handles:
 *   /p/<shortcode>/
 *   /reel/<shortcode>/
 *   /tv/<shortcode>/
 */
function parseInstagramUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const match = url.pathname.match(/^\/(p|reel|tv|reels)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : null;
  } catch {
    return null;
  }
}

/** Maps IG media_type to our ad_type enum. */
function toAdType(mediaType: IGMediaType): "video" | "image" | "carousel" {
  if (mediaType === "VIDEO" || mediaType === "REELS") return "video";
  if (mediaType === "CAROUSEL_ALBUM") return "carousel";
  return "image";
}

/** Best thumbnail URL available for an IG media item. */
function pickThumbnail(media: IGMedia): string | null {
  return media.thumbnail_url ?? media.media_url ?? null;
}

/** Calls the IG insights API for a single media item. Returns null on failure. */
async function fetchInsights(
  mediaId: string,
  mediaType: IGMediaType,
  accessToken: string
): Promise<IGInsightsResponse | null> {
  // Metrics vary by media type
  const reelMetrics = ["plays", "reach", "likes", "comments", "shares", "saved"];
  const photoMetrics = ["impressions", "reach", "likes", "comments", "shares", "saved"];
  const metrics = mediaType === "REELS" ? reelMetrics : photoMetrics;

  const url = new URL(`https://graph.facebook.com/v21.0/${mediaId}/insights`);
  url.searchParams.set("metric", metrics.join(","));
  url.searchParams.set("access_token", accessToken);

  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as IGInsightsResponse;
  } catch {
    return null;
  }
}

/** Derives engagement stats from IG insight items. */
function computeEngagement(
  insights: IGInsightsResponse | null,
  media: IGMedia
): { view_count: number | null; engagement_rate: number | null } {
  if (!insights) {
    return { view_count: null, engagement_rate: null };
  }

  const find = (name: string) =>
    insights.data.find((d) => d.name === name)?.values?.[0]?.value ?? null;

  const reach = find("reach");
  const plays = find("plays");
  const likes = find("likes") ?? media.like_count ?? 0;
  const comments = find("comments") ?? media.comments_count ?? 0;
  const shares = find("shares") ?? 0;
  const saved = find("saved") ?? 0;

  const totalEngagements = likes + comments + shares + saved;
  const denominator = reach ?? plays ?? null;

  return {
    view_count: denominator,
    engagement_rate:
      denominator && denominator > 0
        ? Math.min(totalEngagements / denominator, 1)
        : null,
  };
}

// ─── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── 1. Parse & validate body ────────────────────────────────────────────────
  let body: { url?: unknown; brand_id?: unknown; campaign_id?: unknown; ig_user_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON.");
  }

  const { url, brand_id, campaign_id, ig_user_id } = body;

  if (typeof url !== "string" || !url.trim()) {
    return apiError("MISSING_BODY_FIELD", "Field 'url' is required and must be a non-empty string.");
  }
  if (typeof brand_id !== "string" || !brand_id.trim()) {
    return apiError("MISSING_BODY_FIELD", "Field 'brand_id' is required and must be a UUID string.");
  }

  // ── 2. Parse shortcode from URL ─────────────────────────────────────────────
  const shortcode = parseInstagramUrl(url.trim());
  if (!shortcode) {
    return apiError(
      "INVALID_URL",
      `Could not parse an Instagram shortcode from: ${url}. ` +
        "Expected: instagram.com/p/<shortcode>/, /reel/<shortcode>/, or /tv/<shortcode>/"
    );
  }

  // ── 3. Validate credentials ─────────────────────────────────────────────────
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    return apiError("MISSING_API_KEY", "META_ACCESS_TOKEN is not configured on the server.");
  }

  const igAccountId =
    (typeof ig_user_id === "string" && ig_user_id.trim() ? ig_user_id.trim() : null) ??
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!igAccountId) {
    return apiError(
      "MISSING_API_KEY",
      "INSTAGRAM_BUSINESS_ACCOUNT_ID is not configured. " +
        "Set it in .env.local or pass ig_user_id in the request body."
    );
  }

  // ── 4. Search the account's media for this shortcode ───────────────────────
  // The IG Graph API doesn't provide a "lookup by shortcode" endpoint directly.
  // We must paginate /<ig_user_id>/media and match on shortcode.
  // For practicality, we search the first 50 items (2 pages of 25).

  const mediaFields = [
    "id",
    "shortcode",
    "media_type",
    "media_url",
    "thumbnail_url",
    "permalink",
    "timestamp",
    "caption",
    "like_count",
    "comments_count",
  ].join(",");

  let foundMedia: IGMedia | null = null;
  let nextPageUrl: string | null = null;

  const firstPageUrl = new URL(
    `https://graph.facebook.com/v21.0/${igAccountId}/media`
  );
  firstPageUrl.searchParams.set("fields", mediaFields);
  firstPageUrl.searchParams.set("limit", "25");
  firstPageUrl.searchParams.set("access_token", accessToken);

  // Search up to 2 pages (50 media items) for the shortcode
  let searchUrl: string = firstPageUrl.toString();
  for (let page = 0; page < 2 && !foundMedia; page++) {
    let listData: IGMediaList;
    try {
      const res = await fetch(searchUrl, { headers: { Accept: "application/json" } });
      const json = (await res.json()) as IGMediaList | GraphError;

      if ("error" in json) {
        const err = (json as GraphError).error;
        if (err.code === 190 || err.code === 102) {
          return apiError("MISSING_API_KEY", `META_ACCESS_TOKEN is invalid or expired: ${err.message}`);
        }
        if (err.code === 100) {
          return apiError(
            "VIDEO_NOT_FOUND",
            `Instagram Business Account not found (ID: ${igAccountId}). ${err.message}`
          );
        }
        return apiError("UPSTREAM_ERROR", `Instagram Graph API error ${err.code}: ${err.message}`);
      }

      if (!res.ok) {
        return apiError("UPSTREAM_ERROR", `Instagram Graph API returned HTTP ${res.status}`);
      }

      listData = json as IGMediaList;
    } catch (networkErr) {
      const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
      return apiError("UPSTREAM_ERROR", `Network error contacting Instagram Graph API: ${msg}`);
    }

    foundMedia = listData.data.find((m) => m.shortcode === shortcode) ?? null;
    nextPageUrl = listData.paging?.next ?? null;

    if (!foundMedia && nextPageUrl && page < 1) {
      searchUrl = nextPageUrl;
    }
  }

  if (!foundMedia) {
    return apiError(
      "VIDEO_NOT_FOUND",
      `Instagram post with shortcode "${shortcode}" was not found in the connected business account (ID: ${igAccountId}). ` +
        "Only posts owned by the authenticated business account can be ingested."
    );
  }

  // ── 5. Optionally fetch insights ────────────────────────────────────────────
  const insights = await fetchInsights(foundMedia.id, foundMedia.media_type, accessToken);
  const { view_count, engagement_rate } = computeEngagement(insights, foundMedia);

  // ── 6. Transform → CreativeInsert ───────────────────────────────────────────
  const creativeInsert: CreativeInsert = {
    brand_id: brand_id as string,
    campaign_id: typeof campaign_id === "string" && campaign_id.trim() ? campaign_id.trim() : null,
    platform: "social" as const,
    source_url: foundMedia.permalink,
    thumbnail_url: pickThumbnail(foundMedia),
    view_count,
    engagement_rate,
  };

  // ── 7. Upsert into Supabase ─────────────────────────────────────────────────
  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    return apiError("MISSING_API_KEY", "Supabase credentials are not configured on the server.");
  }

  const { data: creative, error: dbError } = await supabase
    .from("creatives")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert(creativeInsert as any)
    .select()
    .single();

  if (dbError) {
    const pgError = dbError as unknown as { code?: string; message: string };
    const code = supabaseErrorCode(pgError.code);
    return apiError(code, pgError.message);
  }

  // ── 8. Return success ───────────────────────────────────────────────────────
  return Response.json(
    {
      creative,
      meta: {
        media_id: foundMedia.id,
        shortcode: foundMedia.shortcode,
        caption_preview: foundMedia.caption?.slice(0, 120) ?? null,
        media_type: foundMedia.media_type,
        timestamp: foundMedia.timestamp,
        like_count: foundMedia.like_count ?? 0,
        comments_count: foundMedia.comments_count ?? 0,
      },
    },
    { status: 201 }
  );
}
