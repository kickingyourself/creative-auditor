/**
 * lib/buildPreviewData.ts
 *
 * Shared helper that builds the `preview_data` JSON blob stored on a
 * competitive_snapshots row.  Fetches the latest thumbnails and brand
 * metadata from the live DB so the card mosaic always reflects current
 * campaign content.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface PreviewCampaign {
  id: string;
  name: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  first_thumbnail: string | null;
}

export async function buildPreviewData(
  supabase: SupabaseClient,
  campaignIds: string[]
): Promise<{ campaigns: PreviewCampaign[] }> {
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

  // First non-null thumbnail per campaign
  const firstThumb: Record<string, string | null> = {};
  for (const t of (thumbRes.data ?? []) as { campaign_id: string; thumbnail_url: string | null }[]) {
    if (!(t.campaign_id in firstThumb)) firstThumb[t.campaign_id] = t.thumbnail_url;
  }

  const campMap: Record<string, { name: string; brand: { name: string; logo_url: string | null } | null }> = {};
  for (const c of (campRes.data ?? []) as unknown as { id: string; name: string; brands: { name: string; logo_url: string | null } | null }[]) {
    campMap[c.id] = { name: c.name, brand: c.brands };
  }

  return {
    campaigns: campaignIds.map(cid => ({
      id: cid,
      name: campMap[cid]?.name ?? "Unknown",
      brand_name: campMap[cid]?.brand?.name ?? null,
      brand_logo_url: campMap[cid]?.brand?.logo_url ?? null,
      first_thumbnail: firstThumb[cid] ?? null,
    })),
  };
}
