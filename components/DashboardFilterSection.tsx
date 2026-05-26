"use client";

/**
 * components/DashboardFilterSection.tsx
 *
 * Client wrapper that puts a single FilterBar above both the
 * CampaignSummaryGrid and the recent CreativeGrid on the dashboard.
 * Server page passes all data in; filtering is 100% client-side.
 */

import { useState, useMemo } from "react";
import type { Creative } from "@/types";
import { FilterBar, FilterState, EMPTY_FILTER, isFiltered } from "./FilterBar";
import { CampaignSummaryGrid, type CampaignSummary } from "./CampaignSummaryGrid";
import { CreativeGrid } from "./CreativeGrid";

interface Props {
  summaries: CampaignSummary[];
  recentItems: { creative: Creative; brandLogoUrl: string | null }[];
}

export function DashboardFilterSection({ summaries, recentItems }: Props) {
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const active = isFiltered(filter);

  // Derive unique brands from campaign summaries + recent creatives
  const brands = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of summaries) seen.set(s.brand_id, s.brand_name);
    for (const { creative } of recentItems) {
      if (creative.brand_id && creative.brand_name) {
        seen.set(creative.brand_id, creative.brand_name);
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [summaries, recentItems]);

  // Filter campaign summaries
  const filteredSummaries = useMemo(() => {
    if (!active) return summaries;
    const q = filter.text.toLowerCase();
    return summaries.filter((s) => {
      if (filter.brandId && s.brand_id !== filter.brandId) return false;
      // campaigns have no ad_type — ignore that filter here
      if (q) {
        const hay = [s.brand_name, s.campaign_name ?? ""].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [summaries, filter, active]);

  // Filter recent creatives
  const filteredItems = useMemo(() => {
    if (!active) return recentItems;
    const q = filter.text.toLowerCase();
    return recentItems.filter(({ creative }) => {
      if (filter.brandId && creative.brand_id !== filter.brandId) return false;
      if (filter.adType  && creative.ad_type  !== filter.adType)  return false;
      if (q) {
        const hay = [
          creative.title,
          creative.platform,
          creative.brand_name,
          creative.campaign_name,
          creative.ad_type,
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [recentItems, filter, active]);

  const totalCount = summaries.length + recentItems.length;
  const resultCount = filteredSummaries.length + filteredItems.length;

  return (
    <>
      <FilterBar
        brands={brands}
        adTypes={["video", "image", "carousel"]}
        value={filter}
        onChange={setFilter}
        resultCount={active ? resultCount : undefined}
        totalCount={active ? totalCount : undefined}
        placeholder="Search campaigns, creatives, brands…"
      />

      {/* Campaign summary tiles */}
      {filteredSummaries.length > 0 && (
        <CampaignSummaryGrid summaries={filteredSummaries} />
      )}
      {active && filteredSummaries.length === 0 && summaries.length > 0 && (
        <div style={{
          padding: "24px", textAlign: "center",
          border: "1px dashed var(--color-border)", borderRadius: 12,
          marginBottom: 24,
          fontSize: 13, color: "var(--color-text-muted)",
        }}>
          No campaigns match your filters
        </div>
      )}

      {/* Recent creatives header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 18,
      }}>
        <div>
          <h2 style={{
            fontSize: "16px", fontWeight: 700,
            color: "var(--color-text-primary)", letterSpacing: "-0.02em",
          }}>
            Recent Creatives
          </h2>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            {active
              ? `${filteredItems.length} matching creative${filteredItems.length !== 1 ? "s" : ""}`
              : recentItems.length > 0
                ? `Showing ${recentItems.length} most recently ingested`
                : "No creatives ingested yet — head to Brands to get started"}
          </p>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <CreativeGrid items={filteredItems} />
      ) : (
        <div style={{
          padding: "60px 24px", textAlign: "center",
          border: "1px dashed var(--color-border)", borderRadius: "16px",
        }}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "8px" }}>
            {active ? "No creatives match your filters" : "No creatives yet"}
          </p>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            {active
              ? "Try adjusting your search or clearing a filter."
              : "Use the Brands page to capture homepage screenshots or ingest YouTube videos."}
          </p>
        </div>
      )}
    </>
  );
}
