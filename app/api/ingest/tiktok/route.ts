/**
 * app/api/ingest/tiktok/route.ts
 *
 * POST /api/ingest/tiktok
 *
 * Strategy (two-tier):
 *  1. TikTok oEmbed API (no auth) → title, thumbnail_url. Always attempted.
 *  2. TikTok Research API v2 (requires TIKTOK_API_KEY + TIKTOK_API_SECRET)
 *     → view_count, like_count, comment_count, engagement_rate.
 *     Falls back gracefully to null values if credentials are absent.
 *
 * Request body (JSON):
 * {
 *   "url":         string,   // TikTok video URL
 *   "brand_id":    string,   // UUID of the owning brand
 *   "campaign_id": string?   // Optional UUID of a campaign
 * }
 *
 * Success response (201):
 * { "creative": CreativeRow, "meta": { ... } }
 *
 * Error responses:
 *   400  MISSING_BODY_FIELD   – url or brand_id absent
 *   422  INVALID_URL          – Not a recognizable TikTok URL
 *   404  VIDEO_NOT_FOUND      – oEmbed returned no result
 *   409  DUPLICATE_CREATIVE   – source_url already exists for this brand
 *   429  UPSTREAM_RATE_LIMIT  – TikTok rate limit hit
 *   502  UPSTREAM_ERROR       – Non-200 from TikTok oEmbed
 *   500  SUPABASE_INSERT_ERROR / INTERNAL
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { CreativeInsert } from "@/types/database.types";
import { apiError, supabaseErrorCode } from "@/lib/errors";

// ─── Supabase server client ───────────────────────────────────────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

// ─── TikTok API types ─────────────────────────────────────────────────────────

/** TikTok oEmbed response (public, no auth required) */
interface TikTokOEmbedResponse {
  title?: string;
  thumbnail_url?: string;
  author_name?: string;
  author_url?: string;
  provider_name?: string;
  html?: string;
}

/**
 * TikTok Research API — OAuth2 client-credentials token response.
 * Docs: https://developers.tiktok.com/doc/client-access-token-management
 */
interface TikTokTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/**
 * TikTok Research API — video query response (partial).
 * Docs: https://developers.tiktok.com/doc/research-api-codebook
 */
interface TikTokVideoData {
  id?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  video_description?: string;
  create_time?: number; // Unix timestamp
}

interface TikTokResearchResponse {
  data?: { videos?: TikTokVideoData[] };
  error?: { code?: string; message?: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validates that a URL is a recognizable TikTok video URL.
 * Accepted formats:
 *  - https://www.tiktok.com/@handle/video/VIDEO_ID
 *  - https://vm.tiktok.com/SHORTCODE/
 *  - https://vt.tiktok.com/SHORTCODE/
 */
function isValidTikTokUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    const validHostnames = ["www.tiktok.com", "tiktok.com", "vm.tiktok.com", "vt.tiktok.com"];
    if (!validHostnames.includes(url.hostname)) return false;
    // Long-form URL must have /video/ in path
    if (url.hostname.endsWith("tiktok.com") && !url.hostname.startsWith("vm") && !url.hostname.startsWith("vt")) {
      return url.pathname.includes("/video/");
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts the numeric video ID from a long-form TikTok URL.
 * Returns null for short URLs (vm.tiktok.com / vt.tiktok.com) —
 * the Research API accepts the full URL instead.
 */
function extractTikTokVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const match = url.pathname.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Compute engagement_rate, clamped to [0, 1]. Returns null if views = 0. */
function computeEngagementRate(
  viewCount: number | undefined,
  likeCount: number | undefined,
  commentCount: number | undefined
): number | null {
  if (!viewCount) return null;
  const rate = ((likeCount ?? 0) + (commentCount ?? 0)) / viewCount;
  return Math.min(Math.max(rate, 0), 1);
}

// ─── Tier 1: oEmbed ───────────────────────────────────────────────────────────

async function fetchOEmbed(
  videoUrl: string
): Promise<{ ok: true; data: TikTokOEmbedResponse } | { ok: false; code: string; detail: string }> {
  const oEmbedUrl = new URL("https://www.tiktok.com/oembed");
  oEmbedUrl.searchParams.set("url", videoUrl);

  try {
    const res = await fetch(oEmbedUrl.toString(), {
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) {
      return { ok: false, code: "VIDEO_NOT_FOUND", detail: "TikTok oEmbed returned 404." };
    }
    if (res.status === 429) {
      return { ok: false, code: "UPSTREAM_RATE_LIMIT", detail: "TikTok oEmbed rate limit." };
    }
    if (!res.ok) {
      return {
        ok: false,
        code: "UPSTREAM_ERROR",
        detail: `TikTok oEmbed responded with HTTP ${res.status}.`,
      };
    }
    const data = (await res.json()) as TikTokOEmbedResponse;
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, code: "UPSTREAM_ERROR", detail: `Network error on oEmbed: ${msg}` };
  }
}

// ─── Tier 2: Research API ─────────────────────────────────────────────────────

/**
 * Exchanges client credentials for an access token.
 * Returns null (with a console warning) if credentials are absent or the
 * exchange fails — callers must treat null as "stats unavailable".
 */
async function getTikTokAccessToken(
  clientKey: string,
  clientSecret: string
): Promise<string | null> {
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    });
    if (!res.ok) {
      console.warn("[tiktok/ingest] Token exchange failed:", res.status);
      return null;
    }
    const data = (await res.json()) as TikTokTokenResponse;
    if (data.error || !data.access_token) {
      console.warn("[tiktok/ingest] Token error:", data.error_description ?? data.error);
      return null;
    }
    return data.access_token;
  } catch (err) {
    console.warn("[tiktok/ingest] Token network error:", err);
    return null;
  }
}

/**
 * Queries the TikTok Research API for video statistics by video ID.
 * Returns null on any failure (stats are best-effort).
 */
async function fetchTikTokStats(
  accessToken: string,
  videoId: string
): Promise<TikTokVideoData | null> {
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/research/video/query/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          and: [{ operation: "EQ", field_name: "id", field_values: [videoId] }],
        },
        fields:
          "id,view_count,like_count,comment_count,share_count,video_description,create_time",
        // Research API requires a date range — use a wide window
        start_date: "20200101",
        end_date: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
        max_count: 1,
      }),
    });
    if (!res.ok) {
      console.warn("[tiktok/ingest] Research API error:", res.status);
      return null;
    }
    const data = (await res.json()) as TikTokResearchResponse;
    return data.data?.videos?.[0] ?? null;
  } catch (err) {
    console.warn("[tiktok/ingest] Research API network error:", err);
    return null;
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── 1. Parse & validate request body ──────────────────────────────────────
  let body: { url?: unknown; brand_id?: unknown; campaign_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON.");
  }

  const { url, brand_id, campaign_id } = body;

  if (typeof url !== "string" || !url.trim()) {
    return apiError("MISSING_BODY_FIELD", "Field 'url' is required and must be a non-empty string.");
  }
  if (typeof brand_id !== "string" || !brand_id.trim()) {
    return apiError("MISSING_BODY_FIELD", "Field 'brand_id' is required and must be a UUID string.");
  }

  const cleanUrl = url.trim();

  // ── 2. Validate TikTok URL ─────────────────────────────────────────────────
  if (!isValidTikTokUrl(cleanUrl)) {
    return apiError("INVALID_URL", `Not a recognized TikTok video URL: ${cleanUrl}`);
  }

  // ── 3. Tier 1 — fetch oEmbed (thumbnail + title) ──────────────────────────
  const oEmbedResult = await fetchOEmbed(cleanUrl);
  if (!oEmbedResult.ok) {
    return apiError(oEmbedResult.code, oEmbedResult.detail);
  }
  const { data: oEmbed } = oEmbedResult;

  // ── 4. Tier 2 — fetch stats via Research API (best-effort) ─────────────────
  let stats: TikTokVideoData | null = null;
  const clientKey = process.env.TIKTOK_API_KEY;
  const clientSecret = process.env.TIKTOK_API_SECRET;
  const videoId = extractTikTokVideoId(cleanUrl);

  if (clientKey && clientSecret && videoId) {
    const accessToken = await getTikTokAccessToken(clientKey, clientSecret);
    if (accessToken) {
      stats = await fetchTikTokStats(accessToken, videoId);
    }
  } else if (clientKey && clientSecret && !videoId) {
    // Short URL — Research API needs a long-form ID; skip stats gracefully
    console.warn("[tiktok/ingest] Cannot fetch stats for short URL without resolved video ID.");
  }

  // ── 5. Transform → CreativeInsert ─────────────────────────────────────────
  const creativeInsert: CreativeInsert = {
    brand_id: brand_id as string,
    campaign_id: typeof campaign_id === "string" ? campaign_id : null,
    platform: "tiktok" as const,
    source_url: cleanUrl,
    thumbnail_url: oEmbed.thumbnail_url ?? null,
    view_count: stats?.view_count ?? null,
    engagement_rate: computeEngagementRate(
      stats?.view_count,
      stats?.like_count,
      stats?.comment_count
    ),
  };

  // ── 6. Upsert into Supabase ───────────────────────────────────────────────
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

  // ── 7. Return success ─────────────────────────────────────────────────────
  return Response.json(
    {
      creative,
      meta: {
        video_id: videoId,
        title: oEmbed.title ?? null,
        author: oEmbed.author_name ?? null,
        stats_available: stats !== null,
      },
    },
    { status: 201 }
  );
}
