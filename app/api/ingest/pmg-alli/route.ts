/**
 * app/api/ingest/pmg-alli/route.ts
 *
 * POST /api/ingest/pmg-alli
 *
 * Triggers a creative ingest from the Alli platform using the MCP client.
 * Supports two sources:
 *   - digital_asset_manager (DAM)  — primary ad file store
 *   - brand_media                  — brand-level media library
 *
 * Flow:
 *   1. Verify Alli OAuth connection.
 *   2. Open a src_ingest_jobs record (Bronze).
 *   3. Call tools/list on the chosen prefix to discover available tools.
 *   4. Call the list-assets tool to get the file inventory.
 *   5. For each new asset: download the file, upload to Supabase Storage,
 *      insert a creatives row (Silver), mark job complete/partial.
 *
 * GET /api/ingest/pmg-alli/tools?prefix=digital_asset_manager
 *   Returns the raw tools/list response for discovery/debugging.
 *
 * Body (POST):
 *   {
 *     prefix:      "digital_asset_manager" | "brand_media"  (default: "digital_asset_manager")
 *     brand_id:    UUID   (required — which brand to attach assets to)
 *     campaign_id: UUID   (optional — link assets to a campaign)
 *     limit:       number (default: 50)
 *     dry_run:     boolean (default: false — skip file download/storage write)
 *   }
 */

import { createClient } from "@supabase/supabase-js";
import {
  getValidAccessToken,
  alliMcpListTools,
  alliMcpCall,
  AlliAuthError,
} from "@/lib/alli-mcp";
import { apiError } from "@/lib/errors";

// ── Supabase ──────────────────────────────────────────────────────────────────

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// ── GET — tool discovery ───────────────────────────────────────────────────────

export async function GET(req: Request): Promise<Response> {
  const url    = new URL(req.url);
  const prefix = url.searchParams.get("prefix") ?? "digital_asset_manager";

  try {
    await getValidAccessToken(); // will throw if not connected
  } catch (err) {
    if (err instanceof AlliAuthError && err.code === "NOT_CONNECTED") {
      return apiError("ALLI_NOT_CONNECTED", "Connect to Alli first via /settings.");
    }
    throw err;
  }

  try {
    const tools = await alliMcpListTools(prefix);
    return Response.json({ prefix, tools });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: msg }, { status: 502 });
  }
}

// ── POST — run ingest ──────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: {
    prefix?: string;
    brand_id?: string;
    campaign_id?: string;
    limit?: number;
    dry_run?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return apiError("MISSING_BODY_FIELD", "Request body must be valid JSON.");
  }

  const prefix     = body.prefix     ?? "digital_asset_manager";
  const brandId    = body.brand_id;
  const campaignId = body.campaign_id ?? null;
  const limit      = body.limit ?? 50;
  const dryRun     = body.dry_run ?? false;

  if (!brandId) return apiError("MISSING_BODY_FIELD", "brand_id is required.");

  // ── 1. Check Alli OAuth ────────────────────────────────────────────────────
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken();
  } catch (err) {
    if (err instanceof AlliAuthError && err.code === "NOT_CONNECTED") {
      return Response.json(
        { error: "Not connected to Alli. Visit /settings to authenticate.", code: "ALLI_NOT_CONNECTED" },
        { status: 401 },
      );
    }
    throw err;
  }

  const db = getDb();

  // ── 2. Open ingest job (Bronze) ────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job, error: jobErr } = await (db as any)
    .from("src_ingest_jobs")
    .insert({
      source:     "pmg_alli",
      brand_id:   brandId,
      status:     "running",
      started_at: new Date().toISOString(),
      meta:       { prefix, limit, dry_run: dryRun },
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    console.error("[pmg-alli] Failed to create ingest job:", jobErr);
    return apiError("SUPABASE_INSERT_ERROR", "Failed to open ingest job.");
  }

  const jobId: string = job.id;

  // ── 3. Discover available tools ────────────────────────────────────────────
  let listToolName: string | null = null;
  try {
    const { tools } = await alliMcpListTools(prefix);
    // Heuristic: find a tool whose name contains "list" and ("asset" or "media")
    listToolName = tools.find(t =>
      /list/i.test(t.name) && (/asset/i.test(t.name) || /media/i.test(t.name) || /file/i.test(t.name))
    )?.name ?? tools[0]?.name ?? null;
  } catch (err) {
    await closeJob(db, jobId, "failed", 0, String(err));
    return Response.json({
      error: `Could not discover tools on prefix "${prefix}". ${String(err)}`,
      job_id: jobId,
    }, { status: 502 });
  }

  if (!listToolName) {
    await closeJob(db, jobId, "failed", 0, "No list tool found on prefix.");
    return Response.json({ error: "No list tool found.", job_id: jobId }, { status: 502 });
  }

  // ── 4. Call list tool ──────────────────────────────────────────────────────
  let rawAssets: unknown[];
  try {
    const result = await alliMcpCall(prefix, listToolName, { limit });
    // Parse the text content — Alli returns JSON in a text content block
    const textContent = result.content.find(c => c.type === "text")?.text ?? "[]";
    const parsed = JSON.parse(textContent);
    // Normalise: could be array, or { data: [...], items: [...], assets: [...] }
    rawAssets = Array.isArray(parsed)
      ? parsed
      : (parsed.data ?? parsed.items ?? parsed.assets ?? parsed.results ?? []);
  } catch (err) {
    await closeJob(db, jobId, "failed", 0, String(err));
    return Response.json({
      error: `Failed to list assets from Alli: ${String(err)}`,
      job_id: jobId,
      tool_used: listToolName,
    }, { status: 502 });
  }

  if (dryRun) {
    await closeJob(db, jobId, "complete", rawAssets.length, null);
    return Response.json({
      job_id:      jobId,
      dry_run:     true,
      tool_used:   listToolName,
      asset_count: rawAssets.length,
      // Expose first 5 raw records for inspection
      preview:     rawAssets.slice(0, 5),
    });
  }

  // ── 5. Process each asset ──────────────────────────────────────────────────
  const results: { id: string; status: "created" | "skipped" | "error"; reason?: string }[] = [];
  let created = 0;

  for (const raw of rawAssets) {
    const asset = raw as Record<string, unknown>;
    const alliId   = String(asset.id ?? asset.asset_id ?? asset.uuid ?? "");
    const name     = String(asset.name ?? asset.title ?? asset.filename ?? "");
    const fileUrl  = String(asset.url ?? asset.file_url ?? asset.download_url ?? asset.src ?? "");
    const mimeType = String(asset.mime_type ?? asset.content_type ?? "");
    const thumbUrl = String(asset.thumbnail_url ?? asset.preview_url ?? asset.thumb ?? "");

    if (!alliId || !fileUrl) {
      results.push({ id: alliId || "?", status: "skipped", reason: "Missing id or url" });
      continue;
    }

    // Check for existing creative with this alli ID (deduplication)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (db as any)
      .from("creatives")
      .select("id")
      .eq("source_url", fileUrl)
      .eq("brand_id", brandId)
      .maybeSingle();

    if (existing) {
      results.push({ id: alliId, status: "skipped", reason: "Already ingested" });
      continue;
    }

    // Determine platform from metadata
    const platform = inferPlatform(asset);
    const adType   = inferAdType(mimeType, name);

    // Download file from Alli using the access token
    let storagePath: string | null = null;
    let fileSizeBytes: number | null = null;

    try {
      const fileRes = await fetch(fileUrl, {
        headers: { "Authorization": `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(60_000),
      });
      if (!fileRes.ok) throw new Error(`HTTP ${fileRes.status}`);

      const buf  = await fileRes.arrayBuffer();
      fileSizeBytes = buf.byteLength;
      const ext  = extensionFromMime(mimeType) ?? extensionFromName(name) ?? "bin";
      storagePath = `${brandId}/alli/${alliId}.${ext}`;

      const { error: uploadErr } = await db.storage
        .from("creatives")
        .upload(storagePath, buf, {
          contentType: mimeType || "application/octet-stream",
          upsert: true,
        });

      if (uploadErr) throw uploadErr;
    } catch (err) {
      results.push({ id: alliId, status: "error", reason: String(err) });
      continue;
    }

    // Get public URL from storage
    const { data: pubData } = db.storage
      .from("creatives")
      .getPublicUrl(storagePath);
    const publicUrl = pubData?.publicUrl ?? null;

    // Insert creative (Silver)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (db as any)
      .from("creatives")
      .insert({
        brand_id:       brandId,
        campaign_id:    campaignId,
        title:          name,
        platform:       platform,
        ad_type:        adType,
        status:         "active",
        source_url:     fileUrl,
        storage_path:   storagePath,
        thumbnail_url:  thumbUrl || publicUrl,
        file_format:    adType,
        file_size_bytes: fileSizeBytes,
        ingest_source:  "pmg_alli",
        ingest_job_id:  jobId,
        published_at:   asset.created_at ? new Date(asset.created_at as string).toISOString() : new Date().toISOString(),
        created_at:     new Date().toISOString(),
        meta: {
          alli_id:  alliId,
          alli_prefix: prefix,
          raw:      asset,
        },
      });

    if (insertErr) {
      results.push({ id: alliId, status: "error", reason: insertErr.message });
    } else {
      results.push({ id: alliId, status: "created" });
      created++;
    }
  }

  // ── 6. Close job ───────────────────────────────────────────────────────────
  const errors  = results.filter(r => r.status === "error");
  const jobStatus = errors.length > 0 && created === 0 ? "failed"
    : errors.length > 0                                ? "partial"
    : "complete";

  await closeJob(db, jobId, jobStatus, created, errors.length > 0 ? JSON.stringify(errors.slice(0, 5)) : null);

  return Response.json({
    job_id:      jobId,
    status:      jobStatus,
    tool_used:   listToolName,
    total_found: rawAssets.length,
    created,
    skipped:     results.filter(r => r.status === "skipped").length,
    errors:      errors.length,
    error_detail: errors.slice(0, 5),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function closeJob(db: any, jobId: string, status: string, count: number, errorMsg: string | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .from("src_ingest_jobs")
    .update({
      status,
      completed_at:  new Date().toISOString(),
      asset_count:   count,
      error_message: errorMsg,
    })
    .eq("id", jobId);
}

function inferPlatform(asset: Record<string, unknown>): string {
  const tags    = String(asset.tags ?? asset.channels ?? "").toLowerCase();
  const folder  = String(asset.folder ?? asset.category ?? "").toLowerCase();
  const combined = `${tags} ${folder}`;
  if (/youtube/i.test(combined))           return "youtube";
  if (/tiktok/i.test(combined))            return "tiktok";
  if (/meta|facebook|instagram/i.test(combined)) return "meta";
  if (/pinterest/i.test(combined))         return "pinterest";
  if (/landing.?page|lp/i.test(combined)) return "landing_page";
  if (/ooh|out.?of.?home/i.test(combined)) return "ooh";
  if (/tvc|tv.commercial|broadcast/i.test(combined)) return "tvc";
  if (/programmatic|display/i.test(combined)) return "programmatic";
  return "other";
}

function inferAdType(mime: string, name: string): string {
  if (/video|mp4|mov|webm/i.test(mime) || /\.(mp4|mov|webm|m4v)$/i.test(name)) return "video";
  if (/pdf/i.test(mime) || /\.pdf$/i.test(name)) return "image";
  if (/zip/i.test(mime) || /\.zip$/i.test(name)) return "carousel";
  if (/html/i.test(mime) || /\.html?$/i.test(name)) return "carousel";
  return "image";
}

function extensionFromMime(mime: string): string | null {
  const MAP: Record<string, string> = {
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
    "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp",
    "application/pdf": "pdf", "application/zip": "zip", "text/html": "html",
  };
  return MAP[mime] ?? null;
}

function extensionFromName(name: string): string | null {
  const m = name.match(/\.([a-z0-9]{2,6})$/i);
  return m ? m[1].toLowerCase() : null;
}
