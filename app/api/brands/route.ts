/**
 * app/api/brands/route.ts
 *
 * GET /api/brands
 *
 * Returns a lightweight list of all brands for UI selectors.
 * Response: { brands: { id, name, logo_url }[] }
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

export async function GET(): Promise<Response> {
  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const { data, error } = await supabase
    .from("brands")
    .select("id, name, logo_url")
    .order("name", { ascending: true });

  if (error) {
    return apiError("SUPABASE_INSERT_ERROR", error.message);
  }

  return Response.json({ brands: data ?? [] });
}
