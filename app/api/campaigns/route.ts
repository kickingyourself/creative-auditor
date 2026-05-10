/**
 * app/api/campaigns/route.ts
 *
 * GET /api/campaigns?brand_id=<uuid>
 *
 * Returns all campaigns for a brand, ordered by name.
 * Used by the EditCreativeModal campaign autocomplete.
 *
 * Response: { campaigns: { id, name, start_date, end_date }[] }
 */

import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brand_id");

  if (!brandId) {
    return apiError("MISSING_BODY_FIELD", "brand_id query parameter is required.");
  }

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, start_date, end_date")
    .eq("brand_id", brandId)
    .order("name", { ascending: true });

  if (error) {
    return apiError("SUPABASE_INSERT_ERROR", error.message);
  }

  return Response.json({ campaigns: data ?? [] });
}
