/**
 * app/api/campaigns/[id]/route.ts
 *
 * DELETE /api/campaigns/{id}   — permanently delete a campaign
 * PATCH  /api/campaigns/{id}   — update name, start_date, description
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  if (!id?.trim()) return apiError("MISSING_BODY_FIELD", "Campaign ID is required.");

  let body: { name?: string; start_date?: string | null; description?: string | null };
  try { body = await request.json(); }
  catch { return apiError("INVALID_JSON", "Request body must be valid JSON."); }

  // Build only the fields that were sent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  if (body.name       !== undefined) patch.name        = body.name?.trim() || null;
  if (body.start_date !== undefined) patch.start_date  = body.start_date   || null;
  if (body.description !== undefined) patch.description = body.description || null;

  if (!Object.keys(patch).length) {
    return apiError("MISSING_BODY_FIELD", "At least one field (name, start_date, description) is required.");
  }

  let supabase;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const { data, error } = await supabase
    .from("campaigns")
    .update(patch)
    .eq("id", id)
    .select("id, name, start_date, description")
    .single();

  if (error) return apiError("SUPABASE_UPDATE_ERROR", error.message);

  return Response.json({ campaign: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  if (!id?.trim()) return apiError("MISSING_BODY_FIELD", "Campaign ID is required.");

  let supabase;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return apiError("SUPABASE_DELETE_ERROR", error.message);

  return Response.json({ success: true }, { status: 200 });
}
