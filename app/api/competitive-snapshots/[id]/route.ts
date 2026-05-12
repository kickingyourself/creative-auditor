/**
 * app/api/competitive-snapshots/[id]/route.ts
 * DELETE /api/competitive-snapshots/{id}
 * PATCH  /api/competitive-snapshots/{id}  — update name and/or campaign_ids
 */
import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("competitive_snapshots") as any).delete().eq("id", id);
  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ deleted: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  let body: { name?: unknown; campaign_ids?: unknown };
  try { body = await req.json(); }
  catch { return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON."); }

  const { name, campaign_ids } = body;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = {};
  if (typeof name === "string" && name.trim()) patch.name = name.trim();
  if (Array.isArray(campaign_ids) && campaign_ids.length > 0) patch.campaign_ids = campaign_ids;
  if (Object.keys(patch).length === 0) return apiError("MISSING_BODY_FIELD", "Nothing to update.");

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("competitive_snapshots") as any)
    .update(patch).eq("id", id).select().single();
  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ snapshot: data });
}
