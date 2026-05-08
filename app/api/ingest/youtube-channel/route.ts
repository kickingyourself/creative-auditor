/**
 * app/api/ingest/youtube-channel/route.ts
 *
 * POST /api/ingest/youtube-channel
 *
 * Ingests the first N (default 5) most recent videos from a YouTube channel
 * using a 3-call, quota-efficient strategy:
 *   1. channels.list  → uploads playlist ID           (1 quota unit)
 *   2. playlistItems.list → recent video IDs          (1 quota unit)
 *   3. videos.list (batched) → full metadata          (1 quota unit)
 *   Total: 3 units vs 100 for search.list
 *
 * Accepted channel URL formats:
 *   https://www.youtube.com/channel/UCxxxxxx   (channel ID)
 *   https://www.youtube.com/@handle            (handle)
 *   https://www.youtube.com/c/CustomName       (custom URL / legacy username)
 *   https://www.youtube.com/user/Username      (legacy username)
 *
 * Request body (JSON):
 * {
 *   "channel_url": string,   // Any of the above YouTube channel URL formats
 *   "brand_id":    string,   // UUID of the owning brand
 *   "campaign_id": string?,  // Optional UUID of a campaign
 *   "max_results": number?   // How many videos to fetch (1–10, default 5)
 * }
 *
 * Success response (200):
 * {
 *   "summary": { "inserted": number, "duplicates": number, "errors": number },
 *   "results": Array<VideoResult>
 * }
 *
 * VideoResult:
 *   | { status: "inserted";   creative: CreativeRow; meta: VideoMeta }
 *   | { status: "duplicate";  source_url: string }
 *   | { status: "error";      source_url: string; error: string }
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, CreativeInsert } from "@/types/database.types";
import { apiError } from "@/lib/errors";

// ─── Supabase ────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

// ─── UUID guard ───────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toUuidOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return UUID_RE.test(t) ? t : null;
}

// ─── YouTube API types ────────────────────────────────────────────────────────

interface YtChannelResponse {
  items?: Array<{
    id: string;
    contentDetails: { relatedPlaylists: { uploads: string } };
  }>;
  error?: { code: number; message: string };
}

interface YtPlaylistItemsResponse {
  items?: Array<{
    snippet: { resourceId: { videoId: string }; title: string };
  }>;
  error?: { code: number; message: string };
}

interface YtVideoItem {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
    channelTitle: string;
    thumbnails: {
      maxres?: { url: string };
      standard?: { url: string };
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
  statistics: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface YtVideosResponse {
  items?: YtVideoItem[];
  error?: { code: number; message: string };
}

// ─── Channel URL parsing ──────────────────────────────────────────────────────

interface ParsedChannel {
  /** Resolved to a concrete channel ID (UC...) when extractable from the URL */
  channelId?: string;
  /** @handle (new-style) */
  handle?: string;
  /** Legacy username (youtube.com/user/X or youtube.com/c/X) */
  username?: string;
}

function parseChannelUrl(raw: string): ParsedChannel | null {
  try {
    const url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
    if (!url.hostname.includes("youtube.com")) return null;

    const parts = url.pathname.split("/").filter(Boolean);

    // /channel/UCxxxxxx
    if (parts[0] === "channel" && parts[1]?.startsWith("UC")) {
      return { channelId: parts[1] };
    }
    // /@handle
    if (parts[0]?.startsWith("@")) {
      return { handle: parts[0].slice(1) };
    }
    // /c/CustomName  or  /user/Username
    if ((parts[0] === "c" || parts[0] === "user") && parts[1]) {
      return { username: parts[1] };
    }

    return null;
  } catch {
    return null;
  }
}

// ─── YouTube API helpers ──────────────────────────────────────────────────────

async function ytFetch<T>(endpoint: string, params: Record<string, string>, apiKey: string): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable)");
    throw new Error(`YouTube ${endpoint} responded ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Step 1: resolve any channel URL variant → concrete channel ID */
async function resolveChannelId(parsed: ParsedChannel, apiKey: string): Promise<string> {
  // Already have an ID
  if (parsed.channelId) return parsed.channelId;

  const params: Record<string, string> = { part: "id", maxResults: "1" };
  if (parsed.handle)   params.forHandle   = parsed.handle;
  if (parsed.username) params.forUsername = parsed.username;

  const data = await ytFetch<YtChannelResponse>("channels", params, apiKey);
  if (data.error) throw new Error(`channels.list error: ${data.error.message}`);
  const id = data.items?.[0]?.id;
  if (!id) throw new Error("Channel not found for the provided URL.");
  return id;
}

/** Step 2: get uploads playlist ID from channel ID */
async function getUploadsPlaylistId(channelId: string, apiKey: string): Promise<string> {
  const data = await ytFetch<YtChannelResponse>("channels", {
    part: "contentDetails",
    id: channelId,
  }, apiKey);
  if (data.error) throw new Error(`channels.list contentDetails error: ${data.error.message}`);
  const uploadsId = data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsId) throw new Error("Could not find the uploads playlist for this channel.");
  return uploadsId;
}

/** Step 3: get first N video IDs from the uploads playlist */
async function getRecentVideoIds(playlistId: string, maxResults: number, apiKey: string): Promise<string[]> {
  const data = await ytFetch<YtPlaylistItemsResponse>("playlistItems", {
    part: "snippet",
    playlistId,
    maxResults: String(maxResults),
  }, apiKey);
  if (data.error) throw new Error(`playlistItems.list error: ${data.error.message}`);
  return (data.items ?? []).map((i) => i.snippet.resourceId.videoId).filter(Boolean);
}

/** Step 4: batch-fetch full video metadata */
async function getVideoMetadata(videoIds: string[], apiKey: string): Promise<YtVideoItem[]> {
  if (videoIds.length === 0) return [];
  const data = await ytFetch<YtVideosResponse>("videos", {
    part: "snippet,statistics",
    id: videoIds.join(","),
  }, apiKey);
  if (data.error) throw new Error(`videos.list error: ${data.error.message}`);
  return data.items ?? [];
}

// ─── Transform helpers (mirrors single-ingest route) ─────────────────────────

function pickThumbnail(t: YtVideoItem["snippet"]["thumbnails"]): string | null {
  return t.maxres?.url ?? t.standard?.url ?? t.high?.url ?? t.medium?.url ?? t.default?.url ?? null;
}

function computeEngagementRate(v?: string, l?: string, c?: string): number | null {
  const views = parseInt(v ?? "0", 10);
  if (!views) return null;
  const rate = (parseInt(l ?? "0", 10) + parseInt(c ?? "0", 10)) / views;
  return Math.min(Math.max(rate, 0), 1);
}

// ─── Per-video result types ───────────────────────────────────────────────────

type VideoResult =
  | { status: "inserted";  source_url: string; creative_id: string; thumbnail_url: string | null; title: string; view_count: number | null; engagement_rate: number | null }
  | { status: "duplicate"; source_url: string; title: string }
  | { status: "error";     source_url: string; title: string; error: string };

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body: { channel_url?: unknown; brand_id?: unknown; campaign_id?: unknown; max_results?: unknown };
  try {
    body = await request.json();
  } catch {
    return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON.");
  }

  const { channel_url, brand_id, campaign_id, max_results } = body;

  if (typeof channel_url !== "string" || !channel_url.trim()) {
    return apiError("MISSING_BODY_FIELD", "Field 'channel_url' is required.");
  }
  if (typeof brand_id !== "string" || !brand_id.trim()) {
    return apiError("MISSING_BODY_FIELD", "Field 'brand_id' is required.");
  }

  const brandId    = brand_id.trim();
  const campaignId = toUuidOrNull(typeof campaign_id === "string" ? campaign_id : null);
  const maxResults = Math.min(Math.max(typeof max_results === "number" ? max_results : 5, 1), 10);

  // ── 2. Parse channel URL ───────────────────────────────────────────────────
  const parsed = parseChannelUrl(channel_url);
  if (!parsed) {
    return apiError("INVALID_URL", `Could not parse a YouTube channel URL from: ${channel_url}`);
  }

  // ── 3. Check API key ───────────────────────────────────────────────────────
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return apiError("MISSING_API_KEY", "YOUTUBE_API_KEY is not configured on the server.");
  }

  // ── 4. Resolve channel → uploads playlist → video IDs ─────────────────────
  let videoIds: string[];
  let channelTitle = "";
  try {
    const channelId     = await resolveChannelId(parsed, apiKey);
    const uploadsId     = await getUploadsPlaylistId(channelId, apiKey);
    videoIds            = await getRecentVideoIds(uploadsId, maxResults, apiKey);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      return apiError("UPSTREAM_RATE_LIMIT", msg);
    }
    return apiError("UPSTREAM_ERROR", msg);
  }

  if (videoIds.length === 0) {
    return apiError("VIDEO_NOT_FOUND", "No videos found in this channel's uploads playlist.");
  }

  // ── 5. Batch-fetch full metadata ───────────────────────────────────────────
  let videos: YtVideoItem[];
  try {
    videos = await getVideoMetadata(videoIds, apiKey);
    channelTitle = videos[0]?.snippet?.channelTitle ?? "";
  } catch (err) {
    return apiError("UPSTREAM_ERROR", err instanceof Error ? err.message : String(err));
  }

  // ── 6. Insert each video ───────────────────────────────────────────────────
  let supabase;
  try {
    supabase = getSupabase();
  } catch {
    return apiError("MISSING_API_KEY", "Supabase credentials are not configured.");
  }

  const results: VideoResult[] = [];

  for (const video of videos) {
    const sourceUrl      = `https://www.youtube.com/watch?v=${video.id}`;
    const title          = video.snippet.title;
    const thumbnailUrl   = pickThumbnail(video.snippet.thumbnails);
    const viewCount      = video.statistics.viewCount
      ? parseInt(video.statistics.viewCount, 10)
      : null;
    const engagementRate = computeEngagementRate(
      video.statistics.viewCount,
      video.statistics.likeCount,
      video.statistics.commentCount
    );

    const insert: CreativeInsert = {
      brand_id:        brandId,
      campaign_id:     campaignId,
      platform:        "youtube",
      source_url:      sourceUrl,
      thumbnail_url:   thumbnailUrl,
      view_count:      viewCount,
      engagement_rate: engagementRate,
    };

    const { data: creative, error: dbError } = await supabase
      .from("creatives")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insert as any)
      .select("id, thumbnail_url, view_count, engagement_rate")
      .single();

    if (dbError) {
      const pgError = dbError as unknown as { code?: string; message: string };
      if (pgError.code === "23505") {
        // Unique violation → already ingested
        results.push({ status: "duplicate", source_url: sourceUrl, title });
      } else {
        results.push({ status: "error", source_url: sourceUrl, title, error: pgError.message });
      }
    } else {
      results.push({
        status:          "inserted",
        source_url:      sourceUrl,
        creative_id:     (creative as { id: string }).id,
        thumbnail_url:   thumbnailUrl,
        title,
        view_count:      viewCount,
        engagement_rate: engagementRate,
      });
    }
  }

  // ── 7. Build summary ───────────────────────────────────────────────────────
  const summary = {
    inserted:   results.filter((r) => r.status === "inserted").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    errors:     results.filter((r) => r.status === "error").length,
    channel:    channelTitle,
    max_results: maxResults,
  };

  return Response.json({ summary, results }, { status: 200 });
}
