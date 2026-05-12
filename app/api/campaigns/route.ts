/**
 * app/api/campaigns/route.ts
 *
 * GET  /api/campaigns?brand_id=<uuid>  — list campaigns for a brand
 * POST /api/campaigns                  — create a new campaign for a brand
 *
 * Response: { campaigns: { id, name, start_date, end_date }[] }
 *           { campaign: { id, name } }
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

export async function POST(req: Request): Promise<Response> {
  let body: { brand_id?: string; name?: string };
  try { body = await req.json(); }
  catch { return apiError("INVALID_JSON", "Request body must be valid JSON."); }

  const { brand_id, name } = body;
  if (!brand_id || !name?.trim()) {
    return apiError("MISSING_BODY_FIELD", "brand_id and name are required.");
  }

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({ brand_id, name: name.trim() })
    .select("id, name")
    .single();

  if (error) {
    return apiError("SUPABASE_INSERT_ERROR", error.message);
  }

  return Response.json({ campaign: data }, { status: 201 });
}
