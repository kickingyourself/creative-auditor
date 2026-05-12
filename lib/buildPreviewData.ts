/**
 * lib/buildPreviewData.ts
 *
 * Shared helper that builds the `preview_data` JSON blob stored on a
 * competitive_snapshots row.  Fetches up to 4 thumbnails per campaign
 * (not just the first) so the card mosaic can fill all quadrants even
 * when fewer than 4 campaigns are present.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface PreviewCampaign {
  id: string;
  name: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  /** Up to 4 most-recent non-null thumbnail URLs for this campaign. */
  thumbnails: string[];
  /** Kept for backward-compat with rows saved before this schema change. */
  first_thumbnail: string | null;
}

export async function buildPreviewData(
  supabase: SupabaseClient,
  campaignIds: string[]
): Promise<{ campaigns: PreviewCampaign[] }> {
  if (campaignIds.length === 0) return { campaigns: [] };

  const [campRes, thumbRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, brands(id, name, logo_url)")
      .in("id", campaignIds),
    supabase
      .from("creatives")
      .select("campaign_id, thumbnail_url")
      .in("campaign_id", campaignIds)
      .not("thumbnail_url", "is", null)
      .order("created_at", { ascending: false }),
  ]);

  // Collect up to 4 non-null thumbnails per campaign, preserving recency order
  const thumbMap: Record<string, string[]> = {};
  for (const t of (thumbRes.data ?? []) as { campaign_id: string; thumbnail_url: string }[]) {
    if (!thumbMap[t.campaign_id]) thumbMap[t.campaign_id] = [];
    if (thumbMap[t.campaign_id].length < 4) {
      thumbMap[t.campaign_id].push(t.thumbnail_url);
    }
  }

  const campMap: Record<string, { name: string; brand: { name: string; logo_url: string | null } | null }> = {};
  for (const c of (campRes.data ?? []) as unknown as { id: string; name: string; brands: { name: string; logo_url: string | null } | null }[]) {
    campMap[c.id] = { name: c.name, brand: c.brands };
  }

  return {
    campaigns: campaignIds.map(cid => {
      const thumbs = thumbMap[cid] ?? [];
      return {
        id: cid,
        name: campMap[cid]?.name ?? "Unknown",
        brand_name: campMap[cid]?.brand?.name ?? null,
        brand_logo_url: campMap[cid]?.brand?.logo_url ?? null,
        thumbnails: thumbs,
        first_thumbnail: thumbs[0] ?? null,   // backward compat
      };
    }),
  };
}
