/**
 * scripts/backfill-favicons.ts
 *
 * One-time migration: fetches favicons for all brands that have a
 * `website_url` but no `logo_url`, uploads them to Supabase Storage,
 * and updates `brands.logo_url`.
 *
 * Run with:
 *   npx tsx scripts/backfill-favicons.ts
 *
 * Requires the following env vars (reads from .env.local automatically):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (preferred — bypasses RLS)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY  (fallback)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local (no dotenv dependency needed) ─────────────────────────────
// Parses KEY=VALUE lines, ignores comments and blanks, handles quoted values.
function loadEnvFile(filePath: string) {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      // Strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // .env.local is optional (CI may inject vars directly)
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";
const BUCKET = "creative-assets";

// Minimum byte size to accept as a real favicon
// (Google returns a ~148-byte grey globe placeholder for unknown domains)
const MIN_FAVICON_BYTES = 200;

// Concurrency limit — don't hammer Google's API
const CONCURRENCY = 3;

// ── Supabase client ───────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(icon: string, msg: string) {
  console.log(`${icon}  ${msg}`);
}

async function fetchFaviconBuffer(
  websiteUrl: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  let domain: string;
  try {
    domain = new URL(websiteUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CreativeAudit/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength < MIN_FAVICON_BYTES) return null; // placeholder globe

    const contentType = res.headers.get("content-type") ?? "image/png";
    return { buffer, contentType };
  } catch {
    return null;
  }
}

async function processBrand(brand: {
  id: string;
  name: string;
  website_url: string;
}): Promise<"ok" | "no_favicon" | "upload_error" | "update_error"> {
  const favicon = await fetchFaviconBuffer(brand.website_url);

  if (!favicon) {
    log("⚪", `${brand.name} — no favicon found`);
    return "no_favicon";
  }

  const storagePath = `logos/${brand.id}/favicon.png`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, favicon.buffer, {
      contentType: favicon.contentType,
      upsert: true,
    });

  if (uploadErr) {
    log("🔴", `${brand.name} — storage upload failed: ${uploadErr.message}`);
    return "upload_error";
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const { error: updateErr } = await supabase
    .from("brands")
    .update({ logo_url: urlData.publicUrl } as never)
    .eq("id", brand.id);

  if (updateErr) {
    log("🔴", `${brand.name} — DB update failed: ${updateErr.message}`);
    return "update_error";
  }

  log("✅", `${brand.name} — favicon saved (${favicon.buffer.byteLength} bytes)`);
  return "ok";
}

// Runs tasks in batches of `size` concurrently
async function batchProcess<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀  Favicon backfill script\n");

  // Fetch brands that need logos
  const { data: brands, error } = await supabase
    .from("brands")
    .select("id, name, website_url")
    .not("website_url", "is", null)
    .is("logo_url", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌  Could not fetch brands:", error.message);
    process.exit(1);
  }

  type BrandRecord = { id: string; name: string; website_url: string };
  const targets = (brands as BrandRecord[]).filter((b) => b.website_url);

  if (targets.length === 0) {
    log("✨", "All brands already have logos — nothing to do.");
    return;
  }

  log("📋", `Found ${targets.length} brand${targets.length !== 1 ? "s" : ""} without a logo\n`);

  const results = await batchProcess(targets, CONCURRENCY, processBrand);

  // Summary
  const counts = {
    ok:           results.filter((r) => r === "ok").length,
    no_favicon:   results.filter((r) => r === "no_favicon").length,
    upload_error: results.filter((r) => r === "upload_error").length,
    update_error: results.filter((r) => r === "update_error").length,
  };

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  Updated:          ${counts.ok}
  ⚪  No favicon found: ${counts.no_favicon}
  🔴  Upload errors:    ${counts.upload_error}
  🔴  DB errors:        ${counts.update_error}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
