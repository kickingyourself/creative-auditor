/**
 * app/api/competitor-sets/route.ts
 *
 * GET  /api/competitor-sets          — list all sets (with member count)
 * POST /api/competitor-sets          — create a new set
 */

import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(): Promise<Response> {
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("dim_competitor_sets")
    .select(`
      id, name, description, created_at, updated_at,
      dim_competitor_set_members ( brand_id, is_focal, brands ( id, name, logo_url ) )
    `)
    .order("created_at", { ascending: false });

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ sets: data });
}

export async function POST(req: Request): Promise<Response> {
  let body: { name?: string; description?: string } = {};
  try { body = await req.json(); } catch { /* empty body is OK */ }

  const name = body.name?.trim();
  if (!name) return apiError("MISSING_BODY_FIELD", "'name' is required.");

  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("dim_competitor_sets")
    .insert({ name, description: body.description?.trim() ?? null })
    .select("id, name, description, created_at")
    .single();

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ set: data }, { status: 201 });
}
