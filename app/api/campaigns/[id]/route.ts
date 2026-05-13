/**
 * app/api/campaigns/[id]/route.ts
 *
 * DELETE /api/campaigns/{id}
 *
 * Permanently deletes a campaign. Creatives that belong to this campaign
 * have their campaign_id set to NULL (ON DELETE SET NULL in schema).
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!id?.trim()) {
    return apiError("MISSING_BODY_FIELD", "Campaign ID is required.");
  }

  let supabase;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id);

  if (error) {
    return apiError("SUPABASE_DELETE_ERROR", error.message);
  }

  return Response.json({ success: true }, { status: 200 });
}
