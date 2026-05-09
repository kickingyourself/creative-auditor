/**
 * app/api/brands/[id]/route.ts
 *
 * DELETE /api/brands/:id
 *
 * Cascade-deletes a brand and all associated data:
 *   1. Fetches all creatives for the brand (to get storage paths)
 *   2. Deletes all creatives from the DB (or relies on FK cascade)
 *   3. Deletes the brand row
 *   4. Best-effort removes all storage files (creatives + logo)
 *
 * Success (200): { deleted: true, id, creatives_removed: number }
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { apiError } from "@/lib/errors";

const BUCKET = "creative-assets";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

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
    return apiError("MISSING_BODY_FIELD", "A valid brand ID is required.");
  }

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // ── 1. Verify brand exists ────────────────────────────────────────────────
  const { data: brand, error: brandFetchErr } = await supabase
    .from("brands")
    .select("id, name, logo_url")
    .eq("id", id)
    .single();

  if (brandFetchErr || !brand) {
    return apiError("VIDEO_NOT_FOUND", `Brand ${id} not found.`);
  }

  const brandRow = brand as { id: string; name: string; logo_url: string | null };

  // ── 2. Collect all creative storage paths before deletion ─────────────────
  const { data: creatives } = await supabase
    .from("creatives")
    .select("id, source_url, thumbnail_url")
    .eq("brand_id", id);

  const creativeCount = creatives?.length ?? 0;
  const storagePaths: string[] = [];

  for (const c of (creatives ?? []) as { id: string; source_url: string; thumbnail_url: string | null }[]) {
    const src  = storagePathFromUrl(c.source_url);
    const thumb = storagePathFromUrl(c.thumbnail_url);
    if (src)   storagePaths.push(src);
    if (thumb) storagePaths.push(thumb);
  }

  // Include logo
  const logoPath = storagePathFromUrl(brandRow.logo_url);
  if (logoPath) storagePaths.push(logoPath);

  // ── 3. Delete creatives from DB ───────────────────────────────────────────
  if (creativeCount > 0) {
    const { error: creativesDeleteErr } = await supabase
      .from("creatives")
      .delete()
      .eq("brand_id", id);

    if (creativesDeleteErr) {
      return apiError(
        "SUPABASE_INSERT_ERROR",
        `Failed to delete associated creatives: ${creativesDeleteErr.message}`
      );
    }
  }

  // ── 4. Delete brand row ───────────────────────────────────────────────────
  const { error: brandDeleteErr } = await supabase
    .from("brands")
    .delete()
    .eq("id", id);

  if (brandDeleteErr) {
    return apiError("SUPABASE_INSERT_ERROR", `Failed to delete brand: ${brandDeleteErr.message}`);
  }

  // ── 5. Best-effort remove storage files ──────────────────────────────────
  if (storagePaths.length > 0) {
    // Supabase remove accepts max 1000 paths — chunk if needed
    const CHUNK = 500;
    for (let i = 0; i < storagePaths.length; i += CHUNK) {
      supabase.storage
        .from(BUCKET)
        .remove(storagePaths.slice(i, i + CHUNK))
        .catch(() => { /* best-effort */ });
    }
  }

  // Revalidate pages
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");
  revalidatePath("/brands");

  return Response.json({ deleted: true, id, creatives_removed: creativeCount });
}
