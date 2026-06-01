/**
 * app/api/upload/register/route.ts
 *
 * POST /api/upload/register
 *
 * Step 3 of the direct-upload flow. Called after the browser has successfully
 * PUT each file directly to Supabase Storage.
 *
 * Now also:
 *   • Creates src_manual_uploads rows (Bronze)
 *   • Writes ingest_source, ingest_job_id, storage_path, ad_type, file_format
 *     on each creative row (Silver enrichment)
 *   • Marks the src_ingest_jobs row as 'done' or 'partial'
 *
 * Body (JSON):
 *   {
 *     ingest_job_id:  string | null  (from /prepare response)
 *     brand_id:       string  (required)
 *     brand_name:     string  (required — for the response summary)
 *     published_date: string  (required)
 *     items: [
 *       {
 *         storagePath:          string
 *         contentType:          string
 *         platform:             string
 *         campaignId:           string | null
 *         originalName:         string
 *         thumbnailStoragePath: string | null
 *         fileSizeBytes:        number | null
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

/** Derive ad_type from MIME content-type. */
function getAdType(contentType: string): string {
  if (contentType.startsWith("video/"))                    return "video";
  if (contentType.startsWith("image/"))                    return "image";
  if (contentType === "application/pdf")                   return "pdf";
  if (contentType === "text/html")                         return "html5";
  if (contentType.startsWith("application/zip") ||
      contentType.startsWith("application/x-zip"))         return "zip";
  return "image";
}

/** Derive file_format from MIME content-type. */
function getFileFormat(contentType: string): string {
  const map: Record<string, string> = {
    "video/mp4":                      "mp4",
    "video/quicktime":                "mov",
    "image/jpeg":                     "jpg",
    "image/png":                      "png",
    "image/gif":                      "gif",
    "image/webp":                     "webp",
    "image/avif":                     "avif",
    "application/pdf":                "pdf",
    "text/html":                      "html5_bundle",
    "application/zip":                "zip",
    "application/x-zip-compressed":   "zip",
    "application/x-zip":              "zip",
  };
  return map[contentType] ?? "other";
}

interface RegisterItem {
  storagePath:          string;
  contentType:          string;
  platform:             string;
  campaignId:           string | null;
  originalName:         string;
  thumbnailStoragePath: string | null;
  fileSizeBytes?:       number | null;
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
    ingest_job_id?:  string | null;
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

  const ingestJobId   = body.ingest_job_id ?? null;
  const brandId       = body.brand_id?.trim() ?? "";
  const brandName     = body.brand_name?.trim() ?? "";
  const publishedDate = body.published_date?.trim() ?? "";
  const items         = body.items ?? [];

  if (!brandId)      return apiError("MISSING_BODY_FIELD", "'brand_id' is required.");
  if (!items.length) return apiError("MISSING_BODY_FIELD", "At least one item is required.");

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  const results: FileResult[] = [];
  let inserted = 0;
  let errors   = 0;

  for (const item of items) {
    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(item.storagePath);
    const publicUrl = publicUrlData.publicUrl;

    const adType     = getAdType(item.contentType);
    const fileFormat = getFileFormat(item.contentType);

    // Thumbnail URL: for images, the image itself; for videos, the generated frame
    let thumbnailUrl: string | null = null;
    if (adType === "image") {
      thumbnailUrl = publicUrl;
    } else if (item.thumbnailStoragePath) {
      const { data: tpd } = supabase.storage
        .from(BUCKET).getPublicUrl(item.thumbnailStoragePath);
      thumbnailUrl = tpd.publicUrl;
    }

    // ── Create Bronze src_manual_uploads row ─────────────────────────────────
    let srcUploadId: string | null = null;
    if (ingestJobId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: srcRow } = await (supabase as any)
        .from("src_manual_uploads")
        .insert({
          ingest_job_id:   ingestJobId,
          original_name:   item.originalName,
          storage_path:    item.storagePath,
          mime_type:       item.contentType,
          file_size_bytes: item.fileSizeBytes ?? null,
        })
        .select("id")
        .single();
      srcUploadId = srcRow?.id ?? null;
    }

    // ── Promote to Silver (creatives row) ────────────────────────────────────
    const creativeInsert = {
      brand_id:        brandId,
      campaign_id:     item.campaignId,
      platform:        item.platform,
      source_url:      publicUrl,        // kept for backward compat
      storage_path:    item.storagePath, // new Silver column
      thumbnail_url:   thumbnailUrl,
      ad_type:         adType,           // new
      file_format:     fileFormat,       // new
      ingest_source:   "manual_upload",  // new
      ingest_job_id:   ingestJobId,      // new — nullable
      view_count:      null,
      engagement_rate: null,
      status:          "active",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: creative, error: dbErr } = await (supabase as any)
      .from("creatives")
      .insert(creativeInsert)
      .select("id")
      .single();

    if (dbErr) {
      const pgError = dbErr as unknown as { code?: string; message: string };
      if (pgError.code === "23505") {
        results.push({
          status: "error",
          filename: item.originalName,
          storage_url: publicUrl,
          error: "Duplicate — a creative with this URL already exists.",
        });
      } else {
        // Clean up the orphaned file
        await supabase.storage.from(BUCKET).remove([item.storagePath]);
        results.push({
          status: "error",
          filename: item.originalName,
          error: `DB insert failed: ${pgError.message}`,
        });
      }
      errors++;
      continue;
    }

    const row = creative as { id: string };
    inserted++;

    // ── Link Bronze row back to Silver ───────────────────────────────────────
    if (srcUploadId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("src_manual_uploads")
        .update({ fct_creative_id: row.id })
        .eq("id", srcUploadId);
    }

    results.push({
      status: "inserted",
      filename: item.originalName,
      storage_url: publicUrl,
      creative_id: row.id,
    });
  }

  // ── Mark Bronze job as done/partial/error ────────────────────────────────
  if (ingestJobId) {
    const finalStatus = errors === 0
      ? "done"
      : inserted === 0 ? "error" : "partial";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("src_ingest_jobs")
      .update({
        status:         finalStatus,
        promoted_count: inserted,
        finished_at:    new Date().toISOString(),
        ...(errors > 0 && inserted === 0
          ? { error_detail: `All ${errors} file(s) failed to insert.` }
          : {}),
      })
      .eq("id", ingestJobId);
  }

  // Revalidate pages so the new creatives appear
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/");
  if (publishedDate) revalidatePath("/brands");

  return Response.json({
    summary: {
      inserted,
      errors,
      brand_id:       brandId,
      brand_name:     brandName,
      published_date: publishedDate,
    },
    results,
  });
}
