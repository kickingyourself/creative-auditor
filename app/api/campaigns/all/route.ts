/**
 * app/api/campaigns/all/route.ts
 * GET /api/campaigns/all
 * Returns all campaigns with brand info, sorted brand name → campaign name.
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
    .from("campaigns")
    .select("id, name, brand_id, brands(id, name, logo_url)")
    .order("name", { ascending: true });

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);

  // Sort by brand name then campaign name
  const sorted = (data ?? []).sort((a, b) => {
    const ba = (a as unknown as { brands: { name: string } | null }).brands?.name ?? "";
    const bb = (b as unknown as { brands: { name: string } | null }).brands?.name ?? "";
    return ba.localeCompare(bb) || a.name.localeCompare(b.name);
  });

  return Response.json({ campaigns: sorted });
}
