/**
 * app/api/competitor-sets/[id]/route.ts
 *
 * GET    /api/competitor-sets/[id]  — get a single set with members
 * PATCH  /api/competitor-sets/[id]  — update name/description
 * DELETE /api/competitor-sets/[id]  — delete set (members cascade)
 */

import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("dim_competitor_sets")
    .select(`id, name, description, created_at, updated_at,
      dim_competitor_set_members ( brand_id, is_focal, added_at,
        brands ( id, name, logo_url, website_url )
      )`)
    .eq("id", id)
    .single();

  if (error || !data) return apiError("MISSING_BODY_FIELD", "Competitor set not found.");
  return Response.json({ set: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  let body: { name?: string; description?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const updates: Record<string, string | null> = {};
  if (body.name?.trim())        updates.name        = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() ?? null;
  if (!Object.keys(updates).length)
    return apiError("MISSING_BODY_FIELD", "Nothing to update.");

  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("dim_competitor_sets")
    .update(updates)
    .eq("id", id)
    .select("id, name, description, updated_at")
    .single();

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ set: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("dim_competitor_sets")
    .delete()
    .eq("id", id);

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ deleted: true });
}
