/**
 * app/api/upload/prepare/route.ts
 *
 * POST /api/upload/prepare
 *
 * Step 1 of the direct-upload flow. Accepts file metadata (no file bytes),
 * validates the request, finds-or-creates the brand, then generates a
 * Supabase Storage signed upload URL for each file.
 *
 * The browser then PUT-uploads each file directly to Supabase (bypassing
 * Vercel's 4.5 MB serverless payload limit entirely), before calling
 * POST /api/upload/register to persist the creative rows.
 *
 * Body (JSON):
 *   {
 *     brand_name:     string   (required)
 *     brand_website:  string   (optional)
 *     published_date: string   (required, YYYY-MM-DD)
 *     platform:       string   (optional, default "social")
 *     campaign_id:    string   (optional UUID)
 *     files: [
 *       { name: string; size: number; type: string }
 *     ]
 *   }
 *
 * Success (200):
 *   {
 *     brand_id:   string
 *     brand_name: string
 *     uploads: [
 *       { signedUrl: string; storagePath: string; token: string; filename: string }
 *     ]
 *   }
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { apiError } from "@/lib/errors";

const BUCKET = "creative-assets";
const MAX_FILE_SIZE_MB = 500;
const ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  // Programmatic display
  "application/zip",
  "application/x-zip-compressed",
  "application/x-zip",
  "text/html",
]);

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("MISSING_SUPABASE_CONFIG");
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

function safeFilename(original: string): string {
  const dot = original.lastIndexOf(".");
  const ext = (dot !== -1 ? original.slice(dot) : "").toLowerCase();
  const base = (dot !== -1 ? original.slice(0, dot) : original)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "file";
  return `${base}-${Date.now()}${ext}`;
}

function parsePlatform(raw: string | null): "social" | "youtube" | "tiktok" | "homepage" | "meta" | "pinterest" | "programmatic" {
  const allowed = ["social", "youtube", "tiktok", "homepage", "meta", "pinterest", "programmatic"] as const;
  return allowed.includes(raw as (typeof allowed)[number])
    ? (raw as (typeof allowed)[number])
    : "social";
}

interface FileInfo { name: string; size: number; type: string }

export async function POST(request: Request): Promise<Response> {
  let body: {
    brand_name?: string;
    brand_id?: string;
    brand_website?: string;
    published_date?: string;
    platform?: string;
    campaign_id?: string;
    files?: FileInfo[];
  };

  try {
    body = await request.json();
  } catch {
    return apiError("MISSING_BODY_FIELD", "Request body must be JSON.");
  }

  const brandName     = body.brand_name?.trim() ?? "";
  const brandIdParam  = body.brand_id?.trim() ?? "";
  const brandWebsite  = body.brand_website?.trim() ?? "";
  const publishedDate = body.published_date?.trim() ?? "";
  const platform      = parsePlatform(body.platform ?? null);
  const campaignId    = body.campaign_id?.trim() || null;
  const files         = body.files ?? [];

  if (!brandName && !brandIdParam)
    return apiError("MISSING_BODY_FIELD", "'brand_name' or 'brand_id' is required.");
  if (!publishedDate || isNaN(Date.parse(publishedDate)))
    return apiError("MISSING_BODY_FIELD", "'published_date' must be a valid date (YYYY-MM-DD).");
  if (!files.length)
    return apiError("MISSING_BODY_FIELD", "At least one file descriptor is required.");

  // Validate file metadata
  for (const f of files) {
    const normType = (f.type ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME.has(normType))
      return apiError("INVALID_URL", `"${f.name}" has unsupported type "${f.type}". Allowed: MP4, MOV, JPEG, PNG, GIF, WebP, AVIF, ZIP (HTML5), HTML.`);
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024)
      return apiError("INVALID_URL", `"${f.name}" exceeds the ${MAX_FILE_SIZE_MB} MB limit (${(f.size / 1024 / 1024).toFixed(0)} MB).`);
  }

  let supabase: ReturnType<typeof getSupabase>;
  try { supabase = getSupabase(); }
  catch { return apiError("MISSING_API_KEY", "Supabase credentials are not configured."); }

  // ── Resolve brand ────────────────────────────────────────────────────────────
  // If brand_id is provided, look up directly (prevents ghost brand creation).
  // Otherwise fall back to find-or-create by name.
  let brandId: string;
  let resolvedBrandName: string;

  if (brandIdParam) {
    const { data: found } = await supabase.from("brands").select("id, name").eq("id", brandIdParam).single();
    if (!found) return apiError("MISSING_BODY_FIELD", `Brand '${brandIdParam}' not found.`);
    const b = found as { id: string; name: string };
    brandId = b.id;
    resolvedBrandName = b.name;
  } else {
    // Find-or-create by name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await supabase.from("brands").select("id, name").ilike("name", brandName as any).limit(1);
    if (existing && existing.length > 0) {
      const found = existing[0] as { id: string; name: string };
      brandId = found.id;
      resolvedBrandName = found.name;
    } else {
      const payload: { name: string; website_url?: string } = { name: brandName };
      if (brandWebsite) {
        try {
          payload.website_url = new URL(/^https?:\/\//i.test(brandWebsite) ? brandWebsite : `https://${brandWebsite}`).toString();
        } catch { /* ignore */ }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: nb, error: be } = await supabase.from("brands").insert(payload as any).select("id, name").single();
      if (be || !nb) return apiError("SUPABASE_INSERT_ERROR", `Failed to create brand "${brandName}": ${be?.message}`);
      const created = nb as { id: string; name: string };
      brandId = created.id;
      resolvedBrandName = created.name;
    }
  }

  // ── Generate signed upload URLs ─────────────────────────────────────────────
  const uploads: { signedUrl: string; storagePath: string; token: string; filename: string; originalName: string; contentType: string; platform: string; campaignId: string | null; thumbnailSignedUrl: string | null; thumbnailStoragePath: string | null }[] = [];

  for (const f of files) {
    const filename = safeFilename(f.name);
    const storagePath = `uploads/${brandId}/${filename}`;
    const contentType = (f.type.split(";")[0] ?? "application/octet-stream").trim().toLowerCase();

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data)
      return apiError("SUPABASE_INSERT_ERROR", `Could not generate signed URL for "${f.name}": ${error?.message}`);

    // For video files, also generate a signed URL for the thumbnail
    const isVideo = contentType.startsWith("video/");
    let thumbnailSignedUrl: string | null = null;
    let thumbnailStoragePath: string | null = null;

    if (isVideo) {
      const thumbName = filename.replace(/\.[^.]+$/, "") + "-thumb.jpg";
      thumbnailStoragePath = `thumbnails/${brandId}/${thumbName}`;
      const { data: thumbData } = await supabase.storage
        .from(BUCKET)
        .createSignedUploadUrl(thumbnailStoragePath);
      thumbnailSignedUrl = thumbData?.signedUrl ?? null;
    }

    uploads.push({
      signedUrl: data.signedUrl,
      storagePath,
      token: data.token,
      filename: f.name,
      originalName: f.name,
      contentType,
      platform,
      campaignId,
      thumbnailSignedUrl,
      thumbnailStoragePath,
    });
  }

  return Response.json({ brand_id: brandId, brand_name: resolvedBrandName, published_date: publishedDate, uploads });
}
