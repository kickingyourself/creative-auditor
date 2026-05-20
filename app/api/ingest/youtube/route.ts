/**
 * app/api/ingest/youtube/route.ts
 *
 * POST /api/ingest/youtube
 *
 * Accepts a YouTube video URL, fetches metadata via YouTube Data API v3,
 * transforms it, and upserts a row into the `creatives` Supabase table.
 *
 * Request body (JSON):
 * {
 *   "url":         string,   // YouTube video URL (any valid format)
 *   "brand_id":    string,   // UUID of the owning brand
 *   "campaign_id": string?   // Optional UUID of a campaign
 * }
 *
 * Success response (201):
 * { "creative": CreativeRow }
 *
 * Error responses:
 *   400  MISSING_BODY_FIELD   – url or brand_id absent
 *   422  INVALID_URL          – URL doesn't contain a YouTube video ID
 *   404  VIDEO_NOT_FOUND      – YouTube returned 0 items
 *   409  DUPLICATE_CREATIVE   – source_url already exists for this brand
 *   429  UPSTREAM_RATE_LIMIT  – YouTube quota exceeded
 *   500  MISSING_API_KEY      – YOUTUBE_API_KEY not configured
 *   502  UPSTREAM_ERROR       – non-200 from YouTube
 *   500  SUPABASE_INSERT_ERROR / INTERNAL
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { CreativeInsert } from "@/types/database.types";
import { apiError, supabaseErrorCode } from "@/lib/errors";

// ─── Supabase server client (uses service-role key on the server) ────────────
// Falls back to anon key if SERVICE_ROLE_KEY is not set.
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}

// ─── YouTube API types (partial — only the fields we consume) ───────────────

interface YouTubeThumbnail {
  url: string;
  width?: number;
  height?: number;
}

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    publishedAt: string; // ISO-8601
    thumbnails: {
      default?: YouTubeThumbnail;
      medium?: YouTubeThumbnail;
      high?: YouTubeThumbnail;
      standard?: YouTubeThumbnail;
      maxres?: YouTubeThumbnail;
    };
    channelId: string;
    channelTitle: string;
  };
  statistics: {
    viewCount?: string;   // YouTube returns numbers as strings
    likeCount?: string;
    commentCount?: string;
  };
}

interface YouTubeApiResponse {
  items?: YouTubeVideoItem[];
  error?: { code: number; message: string; status?: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts a YouTube video ID from any of the common URL formats:
 *  - https://www.youtube.com/watch?v=VIDEO_ID
 *  - https://youtu.be/VIDEO_ID
 *  - https://www.youtube.com/shorts/VIDEO_ID
 *  - https://m.youtube.com/watch?v=VIDEO_ID
 */
function extractYouTubeVideoId(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);

    // youtu.be short links → pathname is /VIDEO_ID
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id.length === 11 ? id : null;
    }

    // /shorts/VIDEO_ID
    const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];

    // Standard ?v= param
    const v = url.searchParams.get("v");
    if (v && v.length === 11) return v;

    return null;
  } catch {
    return null;
  }
}

/**
 * Picks the highest-resolution thumbnail URL available, falling back
 * through the quality ladder.
 */
function pickThumbnail(
  thumbnails: YouTubeVideoItem["snippet"]["thumbnails"]
): string | null {
  return (
    thumbnails.maxres?.url ??
    thumbnails.standard?.url ??
    thumbnails.high?.url ??
    thumbnails.medium?.url ??
    thumbnails.default?.url ??
    null
  );
}

/**
 * Computes engagement_rate = (likes + comments) / views, clamped to [0, 1].
 * Returns null if view_count is 0 or unavailable.
 */
function computeEngagementRate(
  viewCount: string | undefined,
  likeCount: string | undefined,
  commentCount: string | undefined
): number | null {
  const views = parseInt(viewCount ?? "0", 10);
  if (!views) return null;
  const likes = parseInt(likeCount ?? "0", 10);
  const comments = parseInt(commentCount ?? "0", 10);
  const rate = (likes + comments) / views;
  return Math.min(Math.max(rate, 0), 1);
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

  // ── 2. Extract video ID ────────────────────────────────────────────────────
  const videoId = extractYouTubeVideoId(url.trim());
  if (!videoId) {
    return apiError("INVALID_URL", `Could not parse a YouTube video ID from: ${url}`);
  }

  // ── 3. Validate API key ────────────────────────────────────────────────────
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return apiError("MISSING_API_KEY", "YOUTUBE_API_KEY is not configured on the server.");
  }

  // ── 4. Fetch from YouTube Data API v3 ────────────────────────────────────
  const youtubeUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  youtubeUrl.searchParams.set("part", "snippet,statistics");
  youtubeUrl.searchParams.set("id", videoId);
  youtubeUrl.searchParams.set("key", apiKey);

  let ytData: YouTubeApiResponse;
  try {
    const ytRes = await fetch(youtubeUrl.toString(), {
      headers: { Accept: "application/json" },
      // next: { revalidate: 0 } — don't cache ingest calls
    });

    // Handle upstream HTTP errors
    if (ytRes.status === 429) {
      return apiError("UPSTREAM_RATE_LIMIT", "YouTube Data API quota exceeded.");
    }
    if (!ytRes.ok) {
      const errText = await ytRes.text().catch(() => "(unreadable)");
      return apiError("UPSTREAM_ERROR", `YouTube API responded with ${ytRes.status}: ${errText}`);
    }

    ytData = (await ytRes.json()) as YouTubeApiResponse;
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    return apiError("UPSTREAM_ERROR", `Network error contacting YouTube API: ${msg}`);
  }

  // ── 5. Validate YouTube payload ────────────────────────────────────────────
  if (ytData.error) {
    const code = ytData.error.code;
    if (code === 403) return apiError("UPSTREAM_RATE_LIMIT", ytData.error.message);
    return apiError("UPSTREAM_ERROR", ytData.error.message);
  }

  if (!ytData.items || ytData.items.length === 0) {
    return apiError("VIDEO_NOT_FOUND", `No YouTube video found with ID: ${videoId}`);
  }

  // ── 6. Transform → CreativeInsert ─────────────────────────────────────────
  const item = ytData.items[0];
  const { snippet, statistics } = item;

  const creativeInsert: CreativeInsert = {
    brand_id: brand_id as string,
    campaign_id: typeof campaign_id === "string" ? campaign_id : null,
    platform: "youtube" as const,
    source_url: `https://www.youtube.com/watch?v=${videoId}`, // normalize
    title: snippet.title,
    thumbnail_url: pickThumbnail(snippet.thumbnails),
    posted_at: snippet.publishedAt ?? null,
    view_count: statistics.viewCount ? parseInt(statistics.viewCount, 10) : null,
    engagement_rate: computeEngagementRate(
      statistics.viewCount,
      statistics.likeCount,
      statistics.commentCount
    ),
  };

  // ── 7. Upsert into Supabase ───────────────────────────────────────────────
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
    // Cast to access Postgres error code
    const pgError = dbError as unknown as { code?: string; message: string };
    const code = supabaseErrorCode(pgError.code);
    return apiError(code, pgError.message);
  }

  // ── 8. Return success ─────────────────────────────────────────────────────
  return Response.json(
    {
      creative,
      meta: {
        video_id: videoId,
        channel: snippet.channelTitle,
        published_at: snippet.publishedAt,
        title: snippet.title,
      },
    },
    { status: 201 }
  );
}
