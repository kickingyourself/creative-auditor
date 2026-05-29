/**
 * app/api/competitor-sets/[id]/members/route.ts
 *
 * GET    /api/competitor-sets/[id]/members           — list members
 * POST   /api/competitor-sets/[id]/members           — add a brand to the set
 * DELETE /api/competitor-sets/[id]/members?brand_id= — remove a brand from the set
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
    .from("dim_competitor_set_members")
    .select("brand_id, is_focal, added_at, brands ( id, name, logo_url )")
    .eq("set_id", id)
    .order("is_focal", { ascending: false });

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ members: data });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: setId } = await params;
  let body: { brand_id?: string; is_focal?: boolean } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const brandId = body.brand_id?.trim();
  if (!brandId) return apiError("MISSING_BODY_FIELD", "'brand_id' is required.");

  const sb = getSupabase();

  // If this brand is being set as focal, clear the existing focal brand first
  if (body.is_focal) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any)
      .from("dim_competitor_set_members")
      .update({ is_focal: false })
      .eq("set_id", setId)
      .eq("is_focal", true);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("dim_competitor_set_members")
    .upsert({ set_id: setId, brand_id: brandId, is_focal: body.is_focal ?? false })
    .select("brand_id, is_focal, added_at")
    .single();

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ member: data }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id: setId } = await params;
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand_id")?.trim();
  if (!brandId) return apiError("MISSING_BODY_FIELD", "'brand_id' query param is required.");

  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("dim_competitor_set_members")
    .delete()
    .eq("set_id", setId)
    .eq("brand_id", brandId);

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ deleted: true });
}
