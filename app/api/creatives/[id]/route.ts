/**
 * app/api/creatives/[id]/route.ts
 *
 * PATCH  /api/creatives/:id  — update brand_id, title, created_at, campaign_id
 * DELETE /api/creatives/:id  — delete creative + storage files
 *
 * PATCH success  (200): { updated: true, id }
 * DELETE success (200): { deleted: true, id }
 */

import { createClient } from "@supabase/supabase-js";
import type { Database, CreativeUpdate } from "@/types/database.types";
import { apiError } from "@/lib/errors";

const BUCKET = "creative-assets";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

/**
 * Extracts the storage object path from a public Supabase Storage URL.
 * e.g. https://xyz.supabase.co/storage/v1/object/public/creative-assets/uploads/...
 *      → "uploads/..."
 */
function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!id || typeof id !== "string" || id.length < 10) {
    return apiError("MISSING_BODY_FIELD", "A valid creative ID is required.");
  }

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // ── 1. Fetch creative to get storage URLs ─────────────────────────────────
  const { data: creative, error: fetchErr } = await supabase
    .from("creatives")
    .select("id, source_url, thumbnail_url")
    .eq("id", id)
    .single();

  if (fetchErr || !creative) {
    return apiError("VIDEO_NOT_FOUND", `Creative ${id} not found.`);
  }

  const row = creative as { id: string; source_url: string; thumbnail_url: string | null };

  // ── 2. Delete DB row ───────────────────────────────────────────────────────
  const { error: deleteErr } = await supabase
    .from("creatives")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    return apiError("SUPABASE_INSERT_ERROR", `Failed to delete creative: ${deleteErr.message}`);
  }

  // ── 3. Best-effort delete storage files ───────────────────────────────────
  const pathsToRemove = [
    storagePathFromUrl(row.source_url),
    storagePathFromUrl(row.thumbnail_url),
  ].filter((p): p is string => p !== null);

  if (pathsToRemove.length > 0) {
    // Fire-and-forget — don't block or fail the response on storage errors
    supabase.storage.from(BUCKET).remove(pathsToRemove).catch(() => {
      /* storage cleanup is best-effort */
    });
  }

  // Revalidate dashboard and brands page
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");
  revalidatePath("/brands");

  return Response.json({ deleted: true, id });
}

// ── PATCH ────────────────────────────────────────────────────────────────────

/** Fields the client is allowed to update. */
interface CreativePatch {
  brand_id?:    string;
  title?:       string | null;
  created_at?:  string;
  campaign_id?: string | null;
  platform?:    string;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!id || typeof id !== "string" || id.length < 10) {
    return apiError("MISSING_BODY_FIELD", "A valid creative ID is required.");
  }

  let body: CreativePatch;
  try {
    body = await req.json();
  } catch {
    return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON.");
  }

  const { brand_id, title, created_at, campaign_id, platform } = body;

  // Must supply at least one patchable field
  if (
    brand_id    === undefined &&
    title       === undefined &&
    created_at  === undefined &&
    campaign_id === undefined &&
    platform    === undefined
  ) {
    return apiError(
      "MISSING_BODY_FIELD",
      "Provide at least one of: brand_id, title, created_at, campaign_id, platform."
    );
  }

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // Verify creative exists and get current brand
  const { data: existing, error: fetchErr } = await supabase
    .from("creatives")
    .select("id, brand_id")
    .eq("id", id)
    .single();

  if (fetchErr || !existing) {
    return apiError("VIDEO_NOT_FOUND", `Creative ${id} not found.`);
  }

  // Build sparse update payload
  const patch: CreativeUpdate = {};
  if (brand_id    !== undefined) patch.brand_id    = brand_id;
  if (title       !== undefined) patch.title       = title;
  if (created_at  !== undefined) patch.created_at  = created_at;
  if (campaign_id !== undefined) patch.campaign_id = campaign_id;
  if (platform    !== undefined) (patch as Record<string, unknown>).platform = platform;

  // If brand_id changes, clear campaign_id to avoid cross-brand trigger violation
  const currentBrandId = (existing as { id: string; brand_id: string }).brand_id;
  if (brand_id !== undefined && brand_id !== currentBrandId && campaign_id === undefined) {
    patch.campaign_id = null;
  }

  // Use an untyped client for the update to avoid Supabase generic inference issues
  // with the hand-authored Database type's Update slot.
  const { error: updateErr } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
    .from("creatives")
    .update(patch)
    .eq("id", id);

  if (updateErr) {
    return apiError("SUPABASE_INSERT_ERROR", updateErr.message);
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");
  revalidatePath("/brands");

  return Response.json({ updated: true, id });
}
