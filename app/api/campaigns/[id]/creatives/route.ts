/**
 * app/api/campaigns/[id]/creatives/route.ts
 * GET /api/campaigns/{id}/creatives
 * Returns campaign info + creatives grouped by channel (same order as campaign page).
 */
import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";
import { CHANNELS, getChannelKey } from "@/lib/channels";
import type { Creative } from "@/types";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient(url, key, { auth: { persistSession: false } });
}

interface DbRow {
  id: string; brand_id: string; campaign_id: string | null;
  platform: string; source_url: string; title: string | null;
  thumbnail_url: string | null; view_count: number | null;
  engagement_rate: number | null; created_at: string;
  brands: { name: string; logo_url: string | null } | null;
  campaigns: { id: string; name: string } | null;
}

function toCreative(row: DbRow): { creative: Creative; brandLogoUrl: string | null } {
  const rawPlatform = row.platform === "homepage" ? "landing_page" : row.platform;
  const platform = rawPlatform as Creative["platform"];
  const brandName = row.brands?.name ?? null;
  const brandLogoUrl = row.brands?.logo_url ?? null;

  let derivedTitle = row.source_url;
  try {
    const url = new URL(row.source_url);
    if (rawPlatform === "youtube") {
      const id = url.searchParams.get("v") ?? url.pathname.split("/").pop();
      derivedTitle = `${brandName ?? "YouTube"} · ${id}`;
    } else if (rawPlatform === "landing_page") {
      derivedTitle = `${brandName ?? url.hostname} — Landing Page`;
    } else if (rawPlatform === "tiktok") {
      derivedTitle = `${brandName ?? "TikTok"} · ${url.pathname.split("/").pop()}`;
    } else {
      derivedTitle = url.hostname.replace(/^www\./, "");
    }
  } catch { /* keep source_url */ }

  return {
    creative: {
      id: row.id, brand_id: row.brand_id,
      campaign_id: row.campaign_id,
      campaign_name: row.campaigns?.name ?? null,
      brand_name: brandName,
      title: row.title ?? derivedTitle,
      platform, source_url: row.source_url,
      thumbnail_url: row.thumbnail_url,
      video_url: rawPlatform === "youtube" ? row.source_url : null,
      views: row.view_count, likes: null, comments: null,
      engagement_rate: row.engagement_rate,
      duration_seconds: null, published_at: row.created_at,
      ad_type: rawPlatform === "landing_page" || rawPlatform === "pinterest" ? "image" : "video",
      status: "active", created_at: row.created_at, updated_at: row.created_at,
    },
    brandLogoUrl,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const [campRes, crRes] = await Promise.all([
    supabase.from("campaigns").select("id, name, brands(id, name, logo_url)").eq("id", id).single(),
    supabase.from("creatives")
      .select("id, brand_id, campaign_id, platform, source_url, title, thumbnail_url, view_count, engagement_rate, created_at, brands(name, logo_url), campaigns(id, name)")
      .eq("campaign_id", id).order("created_at", { ascending: false }),
  ]);

  if (campRes.error) return apiError("SUPABASE_INSERT_ERROR", campRes.error.message);
  if (crRes.error)   return apiError("SUPABASE_INSERT_ERROR", crRes.error.message);

  const allItems = (crRes.data as unknown as DbRow[]).map(toCreative);

  const byChannel: Record<string, typeof allItems> = {};
  for (const item of allItems) {
    const key = getChannelKey(item.creative.platform);
    (byChannel[key] ??= []).push(item);
  }
  const channels = CHANNELS
    .filter(ch => (byChannel[ch.key]?.length ?? 0) > 0)
    .map(ch => ({ key: ch.key, label: ch.label, items: byChannel[ch.key] }));

  const camp = campRes.data as unknown as { id: string; name: string; brands: { id: string; name: string; logo_url: string | null } | null };

  return Response.json({
    campaign: { id: camp.id, name: camp.name, brand: camp.brands },
    channels,
  });
}
