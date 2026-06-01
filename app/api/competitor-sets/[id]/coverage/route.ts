/**
 * app/api/competitor-sets/[id]/coverage/route.ts
 *
 * GET /api/competitor-sets/[id]/coverage
 *     ?campaign_id=<uuid>   (optional — filters to a specific campaign)
 *     ?focal_only=true      (optional — return only the focal brand rows)
 *
 * Returns rows from rpt_channel_coverage for the given set.
 * The focal brand's rows have is_focal=true.
 *
 * Response:
 *   {
 *     set_id: string,
 *     focal_brand: { brand_id, brand_name } | null,
 *     channels: [
 *       {
 *         platform: string,
 *         focal_count: number,
 *         set_avg: number,
 *         set_max: number,
 *         set_median: number,
 *         gap_vs_median: number,
 *         gap_vs_leader: number,
 *         pct_of_leader: number,
 *         members: [{ brand_id, brand_name, asset_count, is_focal }]
 *       }
 *     ]
 *   }
 */

import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: setId } = await params;
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaign_id") ?? null;

  const sb = getSupabase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (sb as any)
    .from("rpt_channel_coverage")
    .select("*")
    .eq("set_id", setId);

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  } else {
    query = query.is("campaign_id", null);
  }

  const { data, error } = await query;
  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];

  // Find the focal brand
  const focalRow = rows.find((r: { is_focal: boolean }) => r.is_focal);
  const focalBrand = focalRow
    ? { brand_id: focalRow.brand_id, brand_name: focalRow.brand_name }
    : null;

  // Group by platform
  const channelMap = new Map<string, {
    platform: string;
    focal_count: number;
    set_avg: number;
    set_max: number;
    set_median: number;
    gap_vs_median: number;
    gap_vs_leader: number;
    pct_of_leader: number;
    members: { brand_id: string; brand_name: string; asset_count: number; is_focal: boolean }[];
  }>();

  for (const row of rows) {
    const key = row.platform as string;
    if (!channelMap.has(key)) {
      channelMap.set(key, {
        platform:       key,
        focal_count:    row.is_focal ? Number(row.focal_count) : 0,
        set_avg:        Number(row.set_avg ?? 0),
        set_max:        Number(row.set_max ?? 0),
        set_median:     Number(row.set_median ?? 0),
        gap_vs_median:  row.is_focal ? Number(row.gap_vs_median ?? 0) : 0,
        gap_vs_leader:  row.is_focal ? Number(row.gap_vs_leader ?? 0) : 0,
        pct_of_leader:  row.is_focal ? Number(row.pct_of_leader ?? 0) : 0,
        members:        [],
      });
    }
    const ch = channelMap.get(key)!;
    // Update focal stats if this is the focal row
    if (row.is_focal) {
      ch.focal_count   = Number(row.focal_count);
      ch.gap_vs_median = Number(row.gap_vs_median ?? 0);
      ch.gap_vs_leader = Number(row.gap_vs_leader ?? 0);
      ch.pct_of_leader = Number(row.pct_of_leader ?? 0);
    }
    ch.members.push({
      brand_id:    row.brand_id,
      brand_name:  row.brand_name,
      asset_count: Number(row.focal_count),
      is_focal:    row.is_focal,
    });
  }

  return Response.json({
    set_id:      setId,
    campaign_id: campaignId,
    focal_brand: focalBrand,
    channels:    Array.from(channelMap.values()),
  });
}
