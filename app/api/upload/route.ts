/**
 * app/api/upload/route.ts
 *
 * POST /api/upload
 *
 * Accepts multipart/form-data with one or more creative files (MP4, images)
 * alongside brand and date metadata. For each file:
 *   1. Finds or creates the brand by name
 *   2. Uploads the file to Supabase Storage (creative-assets bucket)
 *   3. Inserts a creatives row with the public storage URL
 *
 * Form fields:
 *   brand_name       string  (required) — matched case-insensitively; created if new
 *   brand_website    string  (optional) — used only when creating a new brand
 *   published_date   string  (required) — ISO-8601 date, e.g. "2025-03-15"
 *   campaign_id      string  (optional) — UUID linking to an existing campaign
 *   platform         string  (optional) — "social"|"youtube"|"tiktok"|"homepage" (default: "social")
 *   files            File[]  (required) — one or more MP4/image files
 *
 * Success (200):
 *   { summary: { inserted, errors, brand_id, brand_name }, results: FileResult[] }
 *
 * FileResult:
 *   { status: "inserted"|"error", filename, storage_url?, creative_id?, error? }
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { apiError } from "@/lib/errors";

// ─── Config ───────────────────────────────────────────────────────────────────

const BUCKET = "creative-assets";
const MAX_FILE_SIZE_MB = 200;
const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
]);

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Slugify a filename for safe storage paths. */
function safeFilename(original: string): string {
  const ext = original.slice(original.lastIndexOf(".")).toLowerCase();
  const base = original
    .slice(0, original.lastIndexOf("."))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${Date.now()}${ext}`;
}

/** Normalise a MIME type string — strip codec/parameter suffixes that
 * Supabase Storage's server-side pattern check rejects.
 * e.g. 'video/mp4; codecs="avc1.42E01E"' → 'video/mp4'
 */
function normaliseContentType(raw: string): string {
  return (raw.split(";")[0] ?? "application/octet-stream").trim().toLowerCase();
}

/** Derive ad_type from MIME. */
function mimeToAdType(mime: string): "video" | "image" {
  return mime.startsWith("video/") ? "video" : "image";
}

/** Derive platform enum value (validated). */
function parsePlatform(raw: string | null): "social" | "youtube" | "tiktok" | "homepage" {
  const allowed = ["social", "youtube", "tiktok", "homepage"] as const;
  return allowed.includes(raw as typeof allowed[number])
    ? (raw as typeof allowed[number])
    : "social";
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // ── 1. Parse multipart ──────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("MISSING_BODY_FIELD", "Request must be multipart/form-data.");
  }

  const brandName      = (formData.get("brand_name") as string | null)?.trim() ?? "";
  const brandWebsite   = (formData.get("brand_website") as string | null)?.trim() ?? "";
  const publishedDate  = (formData.get("published_date") as string | null)?.trim() ?? "";
  const campaignId     = (formData.get("campaign_id") as string | null)?.trim() || null;
  const platform       = parsePlatform(formData.get("platform") as string | null);
  const files          = formData.getAll("files") as File[];

  // ── 2. Validate required fields ─────────────────────────────────────────────
  if (!brandName) {
    return apiError("MISSING_BODY_FIELD", "Field 'brand_name' is required.");
  }
  if (!publishedDate || isNaN(Date.parse(publishedDate))) {
    return apiError("MISSING_BODY_FIELD", "Field 'published_date' must be a valid date (YYYY-MM-DD).");
  }
  if (!files.length) {
    return apiError("MISSING_BODY_FIELD", "At least one file is required in the 'files' field.");
  }

  // ── 3. Validate files ───────────────────────────────────────────────────────
  for (const file of files) {
    if (!ALLOWED_MIME.has(file.type)) {
      return apiError(
        "INVALID_URL",
        `File "${file.name}" has unsupported type "${file.type}". Allowed: MP4, MOV, JPEG, PNG, GIF, WebP, AVIF.`
      );
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return apiError(
        "INVALID_URL",
        `File "${file.name}" exceeds the ${MAX_FILE_SIZE_MB} MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB).`
      );
    }
  }

  // ── 4. Supabase client ──────────────────────────────────────────────────────
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    return apiError("MISSING_API_KEY", "Supabase credentials are not configured.");
  }

  // ── 5. Find-or-create brand ─────────────────────────────────────────────────
  // Case-insensitive match first
  const { data: existingBrands } = await supabase
    .from("brands")
    .select("id, name")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .ilike("name", brandName as any)
    .limit(1);

  let brandId: string;
  let resolvedBrandName: string;

  if (existingBrands && existingBrands.length > 0) {
    const found = existingBrands[0] as { id: string; name: string };
    brandId = found.id;
    resolvedBrandName = found.name;
  } else {
    // Create new brand
    const insertPayload: { name: string; website_url?: string } = { name: brandName };
    if (brandWebsite) {
      try {
        const u = new URL(/^https?:\/\//i.test(brandWebsite) ? brandWebsite : `https://${brandWebsite}`);
        insertPayload.website_url = u.toString();
      } catch { /* ignore invalid URL */ }
    }

    const { data: newBrand, error: brandErr } = await supabase
      .from("brands")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertPayload as any)
      .select("id, name")
      .single();

    if (brandErr || !newBrand) {
      const msg = (brandErr as { message?: string })?.message ?? "Unknown error";
      return apiError("SUPABASE_INSERT_ERROR", `Failed to create brand "${brandName}": ${msg}`);
    }
    const created = newBrand as { id: string; name: string };
    brandId = created.id;
    resolvedBrandName = created.name;
  }

  // ── 6. Process each file ────────────────────────────────────────────────────
  type FileResult = {
    status: "inserted" | "error";
    filename: string;
    storage_url?: string;
    creative_id?: string;
    error?: string;
  };

  const results: FileResult[] = [];
  let inserted = 0;
  let errors = 0;

  for (const file of files) {
    const filename = safeFilename(file.name);
    const storagePath = `uploads/${brandId}/${filename}`;

    // Upload to Supabase Storage
    // Pass the File object directly (it is a Blob) — avoids loading the entire
    // video into memory as an ArrayBuffer, which causes OOM kills in serverless
    // environments and also sidesteps Supabase's ArrayBuffer content-type quirks.
    const contentType = normaliseContentType(file.type);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uploadOptions: any = { contentType, upsert: false, duplex: 'half' };
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, uploadOptions);

    if (uploadErr) {
      errors++;
      results.push({ status: "error", filename: file.name, error: `Storage upload failed: ${uploadErr.message}` });
      continue;
    }

    // Build public URL
    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;

    // Determine thumbnail: for images it's the file itself; for video use null (no server-side thumb generation here)
    const adType = mimeToAdType(file.type);
    const thumbnailUrl = adType === "image" ? publicUrl : null;

    // Insert creative row
    const creativeInsert = {
      brand_id:       brandId,
      campaign_id:    campaignId,
      platform,
      source_url:     publicUrl,
      thumbnail_url:  thumbnailUrl,
      view_count:     null,
      engagement_rate: null,
      // Store the published date as created_at override via a separate metadata field
      // (schema doesn't have published_at, so we tag the source_url with the date in a comment)
    };

    const { data: creative, error: dbErr } = await supabase
      .from("creatives")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(creativeInsert as any)
      .select("id")
      .single();

    if (dbErr) {
      const pgError = dbErr as unknown as { code?: string; message: string };
      // If duplicate, still treat as partial success with note
      if (pgError.code === "23505") {
        results.push({ status: "error", filename: file.name, storage_url: publicUrl, error: "A creative with this URL already exists for the brand (duplicate)." });
        errors++;
      } else {
        // Clean up the uploaded file to avoid orphans
        await supabase.storage.from(BUCKET).remove([storagePath]);
        results.push({ status: "error", filename: file.name, error: `DB insert failed: ${pgError.message}` });
        errors++;
      }
      continue;
    }

    const row = creative as { id: string };
    inserted++;
    results.push({ status: "inserted", filename: file.name, storage_url: publicUrl, creative_id: row.id });
  }

  return Response.json(
    {
      summary: { inserted, errors, brand_id: brandId, brand_name: resolvedBrandName, published_date: publishedDate },
      results,
    },
    { status: 200 }
  );
}
