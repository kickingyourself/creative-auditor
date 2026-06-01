/**
 * app/api/scorecards/route.ts
 *
 * GET  /api/scorecards?campaign_id=<uuid>&creative_id=<uuid>
 *      — list scorecards (filter by campaign and/or creative)
 *
 * POST /api/scorecards
 *      — submit a new scorecard
 *      Body: {
 *        creative_id:     string (required)
 *        campaign_id:     string (required)
 *        reviewer_name:   string (required)
 *        reviewer_id?:    string
 *        score_concept?:  1-5
 *        score_craft?:    1-5
 *        score_brand_fit?: 1-5
 *        score_message?:  1-5
 *        score_cta?:      1-5
 *        score_overall?:  1-5  (computed if omitted)
 *        strengths?:      string[]
 *        improvements?:   string[]
 *        notes?:          string
 *      }
 */

import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaign_id");
  const creativeId = url.searchParams.get("creative_id");

  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (sb as any)
    .from("eval_creative_scorecards")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (campaignId) q = q.eq("campaign_id", campaignId);
  if (creativeId) q = q.eq("creative_id", creativeId);

  const { data, error } = await q;
  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);
  return Response.json({ scorecards: data ?? [] });
}

export async function POST(req: Request): Promise<Response> {
  let body: {
    creative_id?: string;
    campaign_id?: string;
    reviewer_name?: string;
    reviewer_id?: string;
    score_concept?: number;
    score_craft?: number;
    score_brand_fit?: number;
    score_message?: number;
    score_cta?: number;
    score_overall?: number;
    strengths?: string[];
    improvements?: string[];
    notes?: string;
  } = {};

  try { body = await req.json(); } catch {
    return apiError("MISSING_BODY_FIELD", "Request body must be JSON.");
  }

  if (!body.creative_id?.trim()) return apiError("MISSING_BODY_FIELD", "'creative_id' is required.");
  if (!body.campaign_id?.trim()) return apiError("MISSING_BODY_FIELD", "'campaign_id' is required.");
  if (!body.reviewer_name?.trim()) return apiError("MISSING_BODY_FIELD", "'reviewer_name' is required.");

  const dims = [body.score_concept, body.score_craft, body.score_brand_fit, body.score_message, body.score_cta]
    .filter((v): v is number => v != null);
  const computedOverall = dims.length > 0
    ? Math.round((dims.reduce((s, v) => s + v, 0) / dims.length) * 10) / 10
    : null;

  const insert = {
    creative_id:     body.creative_id.trim(),
    campaign_id:     body.campaign_id.trim(),
    reviewer_name:   body.reviewer_name.trim(),
    reviewer_id:     body.reviewer_id?.trim() ?? null,
    score_concept:   body.score_concept   ?? null,
    score_craft:     body.score_craft     ?? null,
    score_brand_fit: body.score_brand_fit ?? null,
    score_message:   body.score_message   ?? null,
    score_cta:       body.score_cta       ?? null,
    score_overall:   body.score_overall   ?? computedOverall,
    strengths:       body.strengths       ?? [],
    improvements:    body.improvements    ?? [],
    notes:           body.notes?.trim()   ?? null,
  };

  const sb = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any)
    .from("eval_creative_scorecards")
    .insert(insert)
    .select("*")
    .single();

  if (error) return apiError("SUPABASE_INSERT_ERROR", error.message);

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/campaigns/${body.campaign_id}`);

  return Response.json({ scorecard: data }, { status: 201 });
}
