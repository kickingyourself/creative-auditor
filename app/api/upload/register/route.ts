/**
 * app/api/upload/register/route.ts
 *
 * POST /api/upload/register
 *
 * Step 3 of the direct-upload flow. Called after the browser has successfully
 * PUT each file directly to Supabase Storage. Inserts the creative rows and
 * returns per-file results.
 *
 * Body (JSON):
 *   {
 *     brand_id:       string  (required)
 *     brand_name:     string  (required — for the response summary)
 *     published_date: string  (required)
 *     items: [
 *       {
 *         storagePath:  string  (path within the bucket)
 *         contentType:  string
 *         platform:     string
 *         campaignId:   string | null
 *         originalName: string  (for error reporting)
 *       }
 *     ]
 *   }
 *
 * Success (200):
 *   { summary: { inserted, errors, brand_id, brand_name }, results: FileResult[] }
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

interface RegisterItem {
  storagePath:  string;
  contentType:  string;
  platform:     string;
  campaignId:   string | null;
  originalName: string;
}

type FileResult = {
  status: "inserted" | "error";
  filename: string;
  storage_url?: string;
  creative_id?: string;
  error?: string;
};

export async function POST(request: Request): Promise<Response> {
  let body: {
    brand_id?:       string;
    brand_name?:     string;
    published_date?: string;
    items?:          RegisterItem[];
  };

  try {
    body = await request.json();
  } catch {
    return apiError("MISSING_BODY_FIELD", "Request body must be JSON.");
  }

  const brandId       = body.brand_id?.trim() ?? "";
  const brandName     = body.brand_name?.trim() ?? "";
  const publishedDate = body.published_date?.trim() ?? "";
  const items         = body.items ?? [];

  if (!brandId)    return apiError("MISSING_BODY_FIELD", "'brand_id' is required.");
  if (!items.length) return apiError("MISSING_BODY_FIELD", "At least one item is required.");

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const results: FileResult[] = [];
  let inserted = 0;
  let errors = 0;

  for (const item of items) {
    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(item.storagePath);
    const publicUrl = publicUrlData.publicUrl;

    const adType = item.contentType.startsWith("video/") ? "video" : "image";
    const thumbnailUrl = adType === "image" ? publicUrl : null;

    const creativeInsert = {
      brand_id:        brandId,
      campaign_id:     item.campaignId,
      platform:        item.platform,
      source_url:      publicUrl,
      thumbnail_url:   thumbnailUrl,
      view_count:      null,
      engagement_rate: null,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creative, error: dbErr } = await supabase.from("creatives").insert(creativeInsert as any).select("id").single();

    if (dbErr) {
      const pgError = dbErr as unknown as { code?: string; message: string };
      if (pgError.code === "23505") {
        results.push({ status: "error", filename: item.originalName, storage_url: publicUrl, error: "Duplicate — a creative with this URL already exists." });
      } else {
        // Clean up the orphaned file
        await supabase.storage.from(BUCKET).remove([item.storagePath]);
        results.push({ status: "error", filename: item.originalName, error: `DB insert failed: ${pgError.message}` });
      }
      errors++;
      continue;
    }

    const row = creative as { id: string };
    inserted++;
    results.push({ status: "inserted", filename: item.originalName, storage_url: publicUrl, creative_id: row.id });
  }

  // Revalidate pages so the new creatives appear
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");
  if (publishedDate) revalidatePath("/brands");

  return Response.json({ summary: { inserted, errors, brand_id: brandId, brand_name: brandName, published_date: publishedDate }, results });
}
