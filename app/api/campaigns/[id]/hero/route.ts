/**
 * app/api/campaigns/[id]/hero/route.ts
 *
 * PATCH /api/campaigns/{id}/hero
 *
 * Sets or clears the hero_creative_id on a campaign.
 * Only one creative per campaign can be the hero; passing null clears it
 * and the UI falls back to the most-recent landing_page creative.
 *
 * Body: { creative_id: string | null }
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
  const { id: campaignId } = await params;

  let body: { creative_id?: unknown };
  try { body = await request.json(); }
  catch { return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON."); }

  const { creative_id } = body;

  // creative_id must be a UUID string or explicitly null
  if (creative_id !== null && (typeof creative_id !== "string" || !creative_id.trim())) {
    return apiError("MISSING_BODY_FIELD", "'creative_id' must be a UUID string or null.");
  }

  let supabase;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // CampaignUpdate includes hero_creative_id via the intersection type in database.types.ts.
  // The explicit cast here insulates against Supabase client generics resolving it as `never`
  // if the generated types cache lags behind the schema.
  type HeroUpdate = { hero_creative_id: string | null };
  const patch = { hero_creative_id: creative_id as string | null } satisfies HeroUpdate;

  const { data, error } = await supabase
    .from("campaigns")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any)
    .eq("id", campaignId)
    .select("id, hero_creative_id")
    .single();

  if (error) {
    return apiError("SUPABASE_UPDATE_ERROR", error.message);
  }

  return Response.json({ campaign: data }, { status: 200 });
}
