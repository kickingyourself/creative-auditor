/**
 * app/api/campaigns/[id]/reorder/route.ts
 *
 * PATCH /api/campaigns/{id}/reorder
 *
 * Accepts an ordered array of creative IDs for a specific platform channel
 * and writes their new sort_order values to the DB in a single upsert.
 *
 * Body: { platform: string; ids: string[] }
 * Success (200): { reordered: true }
 */

import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id: campaignId } = await params;

  let body: { platform?: string; ids?: string[] };
  try { body = await req.json(); }
  catch { return apiError("MISSING_BODY_FIELD", "Invalid JSON body."); }

  const { platform, ids } = body;
  if (!platform || !Array.isArray(ids) || ids.length === 0) {
    return apiError("MISSING_BODY_FIELD", "platform (string) and ids (string[]) are required.");
  }

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // Build upsert rows — index in the array becomes sort_order
  const rows = ids.map((creativeId, index) => ({
    id: creativeId,
    sort_order: index,
  }));

  // Use upsert so we touch only the sort_order column.
  // ignoreDuplicates=false means it WILL update existing rows.
  const { error } = await supabase
    .from("creatives")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: false })
    .select("id");

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);

  return Response.json({ reordered: true });
}
