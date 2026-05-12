/**
 * app/api/competitive-snapshots/route.ts
 * GET  /api/competitive-snapshots  — list all snapshots
 * POST /api/competitive-snapshots  — create a snapshot
 */
import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(): Promise<Response> {
  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const { data, error } = await supabase
    .from("competitive_snapshots")
    .select("id, name, campaign_ids, preview_data, created_at")
    .order("created_at", { ascending: false });

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ snapshots: data ?? [] });
}

export async function POST(req: Request): Promise<Response> {
  let body: { name?: unknown; campaign_ids?: unknown };
  try { body = await req.json(); }
  catch { return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON."); }

  const { name, campaign_ids } = body;
  if (typeof name !== "string" || !name.trim())
    return apiError("MISSING_BODY_FIELD", "'name' is required.");
  if (!Array.isArray(campaign_ids) || campaign_ids.length === 0 || campaign_ids.length > 4)
    return apiError("MISSING_BODY_FIELD", "'campaign_ids' must be an array of 1–4 UUIDs.");

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // Build preview_data: for each campaign, fetch brand + first creative thumbnail
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, brands(id, name, logo_url)")
    .in("id", campaign_ids as string[]);

  const { data: thumbs } = await supabase
    .from("creatives")
    .select("campaign_id, thumbnail_url")
    .in("campaign_id", campaign_ids as string[])
    .order("created_at", { ascending: false });

  // First thumbnail per campaign
  const firstThumb: Record<string, string | null> = {};
  for (const t of (thumbs ?? []) as { campaign_id: string; thumbnail_url: string | null }[]) {
    if (!(t.campaign_id in firstThumb)) firstThumb[t.campaign_id] = t.thumbnail_url;
  }

  const campMap: Record<string, { name: string; brand: { name: string; logo_url: string | null } | null }> = {};
  for (const c of (campaigns ?? []) as unknown as { id: string; name: string; brands: { name: string; logo_url: string | null } | null }[]) {
    campMap[c.id] = { name: c.name, brand: c.brands };
  }

  const preview_data = {
    campaigns: (campaign_ids as string[]).map(cid => ({
      id: cid,
      name: campMap[cid]?.name ?? "Unknown",
      brand_name: campMap[cid]?.brand?.name ?? null,
      brand_logo_url: campMap[cid]?.brand?.logo_url ?? null,
      first_thumbnail: firstThumb[cid] ?? null,
    })),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("competitive_snapshots") as any)
    .insert({ name: name.trim(), campaign_ids, preview_data })
    .select()
    .single();

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ snapshot: data }, { status: 201 });
}
