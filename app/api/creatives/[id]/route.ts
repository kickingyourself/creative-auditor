/**
 * app/api/creatives/[id]/route.ts
 *
 * DELETE /api/creatives/:id
 *
 * 1. Validates the creative exists.
 * 2. Deletes the database row.
 * 3. Best-effort deletes the storage file(s) (source + thumbnail).
 *    Storage errors are logged but never fail the response — the DB row
 *    is the source of truth and is always removed first.
 *
 * Success (200): { deleted: true, id }
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
