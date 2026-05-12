/**
 * app/creatives/page.tsx
 *
 * Full creative library — all ingested creatives, editable, grouped by
 * brand + campaign with a filter summary at the top.
 */

import type { Metadata } from "next";
import { createServerClient } from "@/utils/supabase/server";
import { Creative } from "@/types";
import { CreativeGrid } from "@/components/CreativeGrid";

export const metadata: Metadata = {
  title: "Creatives — Creative Audit",
  description: "Full library of all tracked ad creatives across every brand and campaign.",
};

export const revalidate = 60;

// ── DB row type ───────────────────────────────────────────────────────────────

interface CreativeRow {
  id: string;
  brand_id: string;
  campaign_id: string | null;
  platform: string;
  source_url: string;
  title: string | null;
  thumbnail_url: string | null;
  view_count: number | null;
  engagement_rate: number | null;
  created_at: string;
  brands: { name: string; logo_url: string | null } | null;
  campaigns: { name: string } | null;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function toCreative(row: CreativeRow): { creative: Creative; brandLogoUrl: string | null } {
  // Normalise legacy 'homepage' rows (pre-migration) to 'landing_page'
  const rawPlatform  = row.platform === "homepage" ? "landing_page" : row.platform;
  const platform     = rawPlatform as Creative["platform"];
  const brandName    = row.brands?.name ?? null;
  const brandLogoUrl = row.brands?.logo_url ?? null;

  let derivedTitle = row.source_url;
  try {
    const url = new URL(row.source_url);
    if (rawPlatform === "youtube") {
      const videoId = url.searchParams.get("v") ?? url.pathname.split("/").pop();
      derivedTitle = `${brandName ?? "YouTube"} · ${videoId}`;
    } else if (rawPlatform === "landing_page") {
      derivedTitle = `${brandName ?? url.hostname} — Landing Page`;
    } else if (rawPlatform === "tiktok") {
      derivedTitle = `${brandName ?? "TikTok"} · ${url.pathname.split("/").pop()}`;
    } else {
      derivedTitle = url.hostname.replace(/^www\./, "");
    }
  } catch { /* keep source_url */ }
  const title = row.title ?? derivedTitle;

  return {
    creative: {
      id:               row.id,
      brand_id:         row.brand_id,
      campaign_id:      row.campaign_id,
      campaign_name:    row.campaigns?.name ?? null,
      brand_name:       brandName,
      title,
      platform,
      source_url:       row.source_url,
      thumbnail_url:    row.thumbnail_url,
      video_url:        rawPlatform === "youtube" ? row.source_url : null,
      views:            row.view_count,
      likes:            null,
      comments:         null,
      engagement_rate:  row.engagement_rate,
      duration_seconds: null,
      published_at:     row.created_at,
      ad_type:          rawPlatform === "landing_page" || rawPlatform === "pinterest" ? "image" : "video",
      status:           "active",
      created_at:       row.created_at,
      updated_at:       row.created_at,
    },
    brandLogoUrl,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CreativesPage() {
  let mapped: { creative: Creative; brandLogoUrl: string | null }[] = [];
  let dbError: string | null = null;

  try {
    const supabase = createServerClient();

    // Fetch ALL creatives — no limit
    const { data: rows, error } = await supabase
      .from("creatives")
      .select("id, brand_id, campaign_id, platform, source_url, title, thumbnail_url, view_count, engagement_rate, created_at, brands(name, logo_url), campaigns(name)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    mapped = (rows as CreativeRow[]).map(toCreative);
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div style={{ padding: "28px 28px 64px" }}>
      {/* Page header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{
          fontSize: "22px", fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.025em", marginBottom: "6px",
        }}>
          Creatives
        </h1>
        <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
          {mapped.length > 0
            ? `${mapped.length} creative${mapped.length !== 1 ? "s" : ""} across all brands and campaigns`
            : "No creatives yet — head to Brands to get started"}
        </p>
      </div>

      {/* Error state */}
      {dbError && (
        <div style={{
          padding: "14px 18px",
          background: "rgba(244,63,94,0.08)",
          border: "1px solid rgba(244,63,94,0.2)",
          borderRadius: "10px",
          marginBottom: "24px",
          fontSize: "13px",
          color: "#f43f5e",
        }}>
          ⚠️ {dbError}
        </div>
      )}

      {/* Full grid */}
      {mapped.length > 0 ? (
        <>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: "18px",
          }}>
            <h2 style={{
              fontSize: "16px", fontWeight: 700,
              color: "var(--color-text-primary)", letterSpacing: "-0.02em",
            }}>
              All Creatives
            </h2>
            <span style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>
              {mapped.length} total
            </span>
          </div>
          <CreativeGrid items={mapped} />
        </>
      ) : !dbError && (
        <div style={{
          padding: "60px 24px", textAlign: "center",
          border: "1px dashed var(--color-border)", borderRadius: "16px",
        }}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "8px" }}>
            No creatives yet
          </p>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Use the <strong>Brands</strong> page to capture homepage screenshots or ingest YouTube videos.
          </p>
        </div>
      )}
    </div>
  );
}
