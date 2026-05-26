"use client";

/**
 * components/FilteredCreativeGrid.tsx
 *
 * Client wrapper around CreativeGrid that owns filter state.
 * Server pages pass ALL creatives in as `allItems`; filtering is client-side only.
 */

import { useState, useMemo } from "react";
import type { Creative } from "@/types";
import { CreativeGrid } from "./CreativeGrid";
import { FilterBar, FilterState, EMPTY_FILTER } from "./FilterBar";

interface Props {
  allItems: { creative: Creative; brandLogoUrl: string | null }[];
  /** Show ad-type filter pills? Default true. */
  showAdTypes?: boolean;
}

export function FilteredCreativeGrid({ allItems, showAdTypes = true }: Props) {
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);

  // Derive unique brands from the data
  const brands = useMemo(() => {
    const seen = new Map<string, string>();
    for (const { creative } of allItems) {
      if (creative.brand_id && creative.brand_name) {
        seen.set(creative.brand_id, creative.brand_name);
      }
    }
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allItems]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = filter.text.toLowerCase();
    return allItems.filter(({ creative }) => {
      if (filter.brandId && creative.brand_id !== filter.brandId) return false;
      if (filter.adType  && creative.ad_type  !== filter.adType)  return false;
      if (q) {
        const haystack = [
          creative.title,
          creative.platform,
          creative.brand_name,
          creative.campaign_name,
          creative.ad_type,
          creative.source_url,
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, filter]);

  return (
    <>
      <FilterBar
        brands={brands}
        adTypes={showAdTypes ? ["video", "image", "carousel"] : []}
        value={filter}
        onChange={setFilter}
        resultCount={filtered.length}
        totalCount={allItems.length}
        placeholder="Search title, platform, campaign…"
      />

      {filtered.length === 0 ? (
        <div style={{
          padding: "60px 24px", textAlign: "center",
          border: "1px dashed var(--color-border)", borderRadius: 16,
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>
            No creatives match your filters
          </p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Try adjusting your search or clearing a filter.
          </p>
        </div>
      ) : (
        <CreativeGrid items={filtered} />
      )}
    </>
  );
}
