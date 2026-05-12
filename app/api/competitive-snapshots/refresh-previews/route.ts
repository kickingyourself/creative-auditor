/**
 * app/api/competitive-snapshots/refresh-previews/route.ts
 * POST /api/competitive-snapshots/refresh-previews
 *
 * Refreshes preview_data (thumbnails + brand info) for every snapshot
 * whose campaign_ids are provided, or all snapshots if called with no body.
 * Called on-mount by SnapshotGrid so cards always show the latest thumbnails.
 */
import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";
import { buildPreviewData } from "@/lib/buildPreviewData";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(): Promise<Response> {
  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // Fetch all snapshots
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snapshots, error } = await (supabase.from("competitive_snapshots") as any)
    .select("id, campaign_ids");
  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  if (!snapshots || snapshots.length === 0) return Response.json({ refreshed: 0 });

  // Rebuild preview_data for all snapshots in parallel
  const updates = await Promise.all(
    (snapshots as { id: string; campaign_ids: string[] }[]).map(async (s) => {
      const preview_data = await buildPreviewData(supabase, s.campaign_ids ?? []);
      return { id: s.id, preview_data };
    })
  );

  // Write all updates
  await Promise.all(
    updates.map(({ id, preview_data }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("competitive_snapshots") as any)
        .update({ preview_data })
        .eq("id", id)
    )
  );

  return Response.json({ refreshed: updates.length });
}
