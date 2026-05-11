/**
 * app/page.tsx — Dashboard
 *
 * Async Server Component: fetches real creatives + stats from Supabase
 * at request time (no client-side fetch needed).
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createServerClient } from "@/utils/supabase/server";
import { Creative } from "@/types";
import { CreativeGrid } from "@/components/CreativeGrid";
import { StatCards } from "@/components/StatCards";
import type { StatCardsData } from "@/components/StatCards";
import { CampaignSummaryGrid } from "@/components/CampaignSummaryGrid";
import type { CampaignSummary } from "@/components/CampaignSummaryGrid";

export const metadata: Metadata = {
  title: "Dashboard — Creative Audit",
  description: "Overview of tracked ad creative across all brands and platforms.",
};

// Revalidate every 60 seconds so new ingestions appear without a full deploy
export const revalidate = 60;

// ─── DB row type (with joined brand name) ────────────────────────────────────

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

// ─── Mapper: DB row → Creative card interface ─────────────────────────────────

function toCreative(row: CreativeRow): { creative: Creative; brandLogoUrl: string | null } {
  const platform = row.platform as Creative["platform"];
  const brandName = row.brands?.name ?? null;
  const brandLogoUrl = row.brands?.logo_url ?? null;

  // Use the user-set title from DB if present, otherwise derive from URL
  let derivedTitle = row.source_url;
  try {
    const url = new URL(row.source_url);
    if (row.platform === "youtube") {
      const videoId = url.searchParams.get("v") ?? url.pathname.split("/").pop();
      derivedTitle = `${brandName ?? "YouTube"} · ${videoId}`;
    } else if (row.platform === "landing_page") {
      derivedTitle = `${brandName ?? url.hostname} — Landing Page`;
    } else if (row.platform === "tiktok") {
      derivedTitle = `${brandName ?? "TikTok"} · ${url.pathname.split("/").pop()}`;
    } else {
      derivedTitle = url.hostname.replace(/^www\./, "");
    }
  } catch {
    /* keep source_url as derivedTitle */
  }
  const title = row.title ?? derivedTitle;

  const adType: Creative["ad_type"] =
    row.platform === "landing_page" ? "image" : "video";

  return {
    creative: {
      id:              row.id,
      brand_id:        row.brand_id,
      campaign_id:     row.campaign_id,
      campaign_name:   row.campaigns?.name ?? null,
      brand_name:      brandName,
      title,
      platform,
      source_url:      row.source_url,
      thumbnail_url:   row.thumbnail_url,
      video_url:       row.platform === "youtube" ? row.source_url : null,
      views:           row.view_count,
      likes:           null,
      comments:        null,
      engagement_rate: row.engagement_rate,
      duration_seconds: null,
      published_at:    row.created_at,
      ad_type:         adType,
      status:          "active",
      created_at:      row.created_at,
      updated_at:      row.created_at,
    },
    brandLogoUrl,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  let mapped: { creative: Creative; brandLogoUrl: string | null }[] = [];
  let statsData: StatCardsData = {
    totalCreatives: 0,
    totalBrands: 0,
    totalViews: 0,
    topPlatform: "—",
  };
  let summaries: CampaignSummary[] = [];
  let dbError = false;

  try {
    const supabase = createServerClient();

    // ── Fetch latest 20 creatives with brand name joined ──────────────────────
    const { data: rows, error: rowsErr } = await supabase
      .from("creatives")
      .select("id, brand_id, campaign_id, platform, source_url, title, thumbnail_url, view_count, engagement_rate, created_at, brands(name, logo_url), campaigns(name)")
      .order("created_at", { ascending: false })
      .limit(20);

    if (rowsErr) throw rowsErr;
    mapped = (rows as CreativeRow[]).map(toCreative);

    // ── Aggregate stats ───────────────────────────────────────────────────────
    const [
      { count: totalCreatives },
      { count: totalBrands },
      { data: viewData },
      { data: platformData },
    ] = await Promise.all([
      supabase.from("creatives").select("id", { count: "exact", head: true }),
      supabase.from("brands").select("id", { count: "exact", head: true }),
      supabase.from("creatives").select("view_count"),
      supabase.from("creatives").select("platform"),
    ]);

    const totalViews = ((viewData ?? []) as { view_count: number | null }[]).reduce(
      (sum, r) => sum + (r.view_count ?? 0), 0
    );

    // Top platform by count
    const platformCounts: Record<string, number> = {};
    ((platformData ?? []) as { platform: string }[]).forEach((r) => {
      platformCounts[r.platform] = (platformCounts[r.platform] ?? 0) + 1;
    });
    const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    statsData = {
      totalCreatives: totalCreatives ?? 0,
      totalBrands:    totalBrands    ?? 0,
      totalViews,
      topPlatform,
    };

    // ── Brand+Campaign summary ─────────────────────────────────────────────
    // Fetch all creatives with brand + campaign info (no limit) for grouping.
    const { data: allRows } = await supabase
      .from("creatives")
      .select("brand_id, campaign_id, platform, thumbnail_url, brands(name, logo_url), campaigns(name)")
      .order("created_at", { ascending: false });

    if (allRows) {
      // Group by brand_id + campaign_id (null = uncategorised)
      const groupMap = new Map<string, CampaignSummary>();

      for (const row of allRows as {
        brand_id: string;
        campaign_id: string | null;
        platform: string;
        thumbnail_url: string | null;
        brands: { name: string; logo_url: string | null } | null;
        campaigns: { name: string } | null;
      }[]) {
        const key = `${row.brand_id}::${row.campaign_id ?? "__none__"}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, {
            brand_id:      row.brand_id,
            brand_name:    row.brands?.name ?? "Unknown Brand",
            brand_logo_url: row.brands?.logo_url ?? null,
            campaign_id:   row.campaign_id,
            campaign_name: row.campaigns?.name ?? null,
            creative_count: 0,
            thumbnails: [],
            platforms: [],
          });
        }

        const group = groupMap.get(key)!;
        group.creative_count++;
        if (group.thumbnails.length < 4 && row.thumbnail_url) {
          group.thumbnails.push(row.thumbnail_url);
        }
        if (!group.platforms.includes(row.platform)) {
          group.platforms.push(row.platform);
        }
      }

      // Sort: named campaigns first, then uncategorised; alphabetically within each
      summaries = Array.from(groupMap.values()).sort((a, b) => {
        if (!!a.campaign_id !== !!b.campaign_id) return a.campaign_id ? -1 : 1;
        return (a.brand_name + (a.campaign_name ?? "")).localeCompare(
                b.brand_name + (b.campaign_name ?? ""));
      });
    }
  } catch {
    dbError = true;
  }

  return (
    <div style={{ padding: "28px 28px 48px" }}>
      {/* Page header */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{
          fontSize: "22px", fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.025em", marginBottom: "6px",
        }}>
          Dashboard
        </h1>
        <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
          Overview of tracked ad creative across all brands and platforms.
        </p>
      </div>

      {/* DB connection error banner */}
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
          ⚠️ Could not connect to Supabase. Check your credentials in <code>.env.local</code> and ensure the migrations have been run.
        </div>
      )}

      {/* Live stat cards */}
      <StatCards data={statsData} />

      {/* Brand + Campaign overview */}
      <CampaignSummaryGrid summaries={summaries} />

      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: "18px",
      }}>
        <div>
          <h2 style={{
            fontSize: "16px", fontWeight: 700,
            color: "var(--color-text-primary)", letterSpacing: "-0.02em",
          }}>
            Recent Creatives
          </h2>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {mapped.length > 0
              ? `Showing ${mapped.length} most recently ingested`
              : "No creatives ingested yet — head to Brands to get started"}
          </p>
        </div>
        <Link
          href="/brands"
          id="btn-view-all-creatives"
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", borderRadius: "8px",
            border: "1px solid var(--color-border)",
            background: "transparent",
            color: "var(--color-text-secondary)",
            fontSize: "13px", fontWeight: 500,
            cursor: "pointer", textDecoration: "none",
            transition: "all 150ms ease",
          }}
        >
          Go to Brands
          <ArrowUpRight size={14} />
        </Link>
      </div>

      {/* Empty state */}
      {mapped.length === 0 && !dbError && (
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

      {/* Creatives grid */}
      {mapped.length > 0 && (
        <CreativeGrid items={mapped} />
      )}
    </div>
  );
}
