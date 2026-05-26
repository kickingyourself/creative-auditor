/**
 * app/api/creatives/thumbnail/route.ts
 *
 * POST /api/creatives/thumbnail
 *
 * Accepts a multipart form with:
 *   - file:        JPEG blob (the captured thumbnail frame)
 *   - creative_id: UUID of the creative to update
 *
 * Uploads the JPEG to Supabase Storage under thumbnails/{brand_id}/{creative_id}-thumb.jpg,
 * then PATCHes the creative's thumbnail_url in the DB.
 *
 * Success (200): { thumbnail_url: string }
 */

import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/errors";

const BUCKET = "creative-assets";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request): Promise<Response> {
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return apiError("MISSING_BODY_FIELD", "Expected multipart form data."); }

  const file        = formData.get("file") as Blob | null;
  const creativeId  = (formData.get("creative_id") as string | null)?.trim();

  if (!file || !creativeId) {
    return apiError("MISSING_BODY_FIELD", "'file' and 'creative_id' are required.");
  }

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // Fetch the creative to get brand_id
  const { data: creative, error: fetchErr } = await supabase
    .from("creatives")
    .select("id, brand_id")
    .eq("id", creativeId)
    .single();

  if (fetchErr || !creative) {
    return apiError("VIDEO_NOT_FOUND", `Creative ${creativeId} not found.`);
  }

  const row = creative as { id: string; brand_id: string };
  const storagePath = `thumbnails/${row.brand_id}/${row.id}-thumb.jpg`;

  // Upload the JPEG
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: "image/jpeg",
      upsert: true,           // overwrite if a thumb already exists
    });

  if (uploadErr) {
    return apiError("SUPABASE_INSERT_ERROR", `Thumbnail upload failed: ${uploadErr.message}`);
  }

  // Get the public URL
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const thumbnailUrl = urlData.publicUrl;

  // Patch the creative row
  const { error: updateErr } = await supabase
    .from("creatives")
    .update({ thumbnail_url: thumbnailUrl } as Record<string, unknown>)
    .eq("id", creativeId);

  if (updateErr) {
    return apiError("SUPABASE_INSERT_ERROR", `Failed to update thumbnail_url: ${updateErr.message}`);
  }

  return Response.json({ thumbnail_url: thumbnailUrl });
}
