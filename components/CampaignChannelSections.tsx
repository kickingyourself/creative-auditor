"use client";

/**
 * components/CampaignChannelSections.tsx
 *
 * Client component that owns hero state for the campaign detail page.
 * - Manages heroCreativeId in local state (optimistic updates)
 * - Calls PATCH /api/campaigns/{id}/hero on toggle
 * - Renders the hero banner (reactive — updates instantly when crown is clicked)
 * - Renders each channel section via CreativeGrid with crown props
 * - Renders the Add Creative tile
 * - Renders the empty channel label strip
 */

import { useState, useCallback, useEffect } from "react";
import { Layers, Crown } from "lucide-react";
import { Creative } from "@/types";
import { CreativeGrid } from "@/components/CreativeGrid";
import { AddCreativeTile } from "@/components/AddCreativeTile";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChannelData {
  key: string;
  label: string;
  items: { creative: Creative; brandLogoUrl: string | null }[];
}

interface Props {
  filledChannels: ChannelData[];
  emptyChannelLabels: string[];
  allCreatives: { creative: Creative; brandLogoUrl: string | null }[];
  campaignId: string;
  campaignName: string;
  brandId: string;
  brandName: string;
  brandLogoUrl: string | null;
  /** hero_creative_id from the DB — null if unset */
  initialHeroCreativeId: string | null;
}

// ── Hero banner ───────────────────────────────────────────────────────────────

function HeroBanner({ item }: { item: { creative: Creative; brandLogoUrl: string | null } | undefined }) {
  if (!item) return null;
  const { creative } = item;

  const platformLabel =
    creative.platform === "landing_page" ? "Landing Page"
    : creative.platform === "youtube"    ? "YouTube"
    : creative.platform === "pinterest"  ? "Pinterest"
    : creative.platform.charAt(0).toUpperCase() + creative.platform.slice(1);

  return (
    <div style={{ marginBottom: "40px" }}>
      {/* Banner */}
      <div style={{
        borderRadius: "16px",
        overflow: "hidden",
        border: "1.5px solid rgba(251,191,36,0.65)",
      }}>
        {creative.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.thumbnail_url}
            alt={creative.title ?? ""}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "100%",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--color-text-muted)", fontSize: "14px",
          }}>
            No preview available
          </div>
        )}

        {/* Hero label */}
        <div style={{
          position: "absolute", top: 14, left: 14,
          display: "flex", alignItems: "center", gap: "6px",
          background: "rgba(251,191,36,0.9)",
          backdropFilter: "blur(8px)",
          padding: "4px 10px", borderRadius: "20px",
        }}>
          <Crown size={10} color="#1a1a1a" fill="#1a1a1a" />
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Hero
          </span>
        </div>

        {/* Platform badge */}
        <span style={{
          position: "absolute", top: 14, right: 14,
          fontSize: "10px", fontWeight: 700,
          background: "rgba(0,0,0,0.6)", color: "#fff",
          backdropFilter: "blur(8px)",
          padding: "4px 10px", borderRadius: "20px",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          {platformLabel}
        </span>
      </div>

      {/* Title */}
      {creative.title && (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "10px" }}>
          {creative.title}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CampaignChannelSections({
  filledChannels,
  emptyChannelLabels,
  allCreatives,
  campaignId,
  campaignName,
  brandId,
  brandName,
  brandLogoUrl,
  initialHeroCreativeId,
}: Props) {
  const HERO_KEY = `campaign-hero-${campaignId}`;

  // Initialize from DB value (null until migration runs)
  const [heroCreativeId, setHeroCreativeId] = useState<string | null>(initialHeroCreativeId);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // On mount: if DB returned null (migration pending), read from localStorage
  useEffect(() => {
    if (initialHeroCreativeId !== null) {
      // DB is the source of truth — clear any stale localStorage entry
      localStorage.removeItem(HERO_KEY);
    } else {
      const stored = localStorage.getItem(HERO_KEY);
      if (stored) setHeroCreativeId(stored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // Resolve the hero item to display in the banner:
  // 1. Pinned creative (if set)
  // 2. Most recent landing_page creative (fallback)
  const heroItem =
    (heroCreativeId
      ? allCreatives.find(c => c.creative.id === heroCreativeId)
      : null) ??
    allCreatives.find(c => c.creative.platform === "landing_page") ??
    undefined;

  const handleToggleHero = useCallback(async (creativeId: string) => {
    if (togglingId) return;
    const newHeroId = heroCreativeId === creativeId ? null : creativeId;

    // Optimistic update + localStorage persistence (survives page reloads
    // until the DB migration runs and takes over)
    setHeroCreativeId(newHeroId);
    setTogglingId(creativeId);
    if (newHeroId) {
      localStorage.setItem(HERO_KEY, newHeroId);
    } else {
      localStorage.removeItem(HERO_KEY);
    }

    try {
      await fetch(`/api/campaigns/${campaignId}/hero`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creative_id: newHeroId }),
      });
    } catch {
      // Rollback
      setHeroCreativeId(heroCreativeId);
      if (heroCreativeId) {
        localStorage.setItem(HERO_KEY, heroCreativeId);
      } else {
        localStorage.removeItem(HERO_KEY);
      }
    } finally {
      setTogglingId(null);
    }
  }, [campaignId, heroCreativeId, togglingId, HERO_KEY]);

  return (
    <>
      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <HeroBanner item={heroItem} />

      {/* ── Filled channel sections ──────────────────────────────────────── */}
      {filledChannels.map(ch => (
        <section key={ch.key} style={{ marginBottom: "48px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "16px",
          }}>
            <Layers size={14} color="var(--color-accent)" />
            <h2 style={{
              fontSize: "16px", fontWeight: 700,
              color: "var(--color-text-primary)", letterSpacing: "-0.02em",
            }}>
              {ch.label}
            </h2>
            <span style={{
              fontSize: "11px", fontWeight: 600,
              color: "var(--color-accent)",
              background: "rgba(79,179,186,0.1)",
              border: "1px solid rgba(79,179,186,0.2)",
              padding: "2px 8px", borderRadius: "20px",
            }}>
              {ch.items.length}
            </span>
          </div>
          <CreativeGrid
            items={ch.items}
            heroCreativeId={heroCreativeId}
            onToggleHero={handleToggleHero}
          />
        </section>
      ))}

      {/* ── Add creative tile ─────────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: "18px",
        marginBottom: "40px",
      }}>
        <AddCreativeTile
          brandId={brandId}
          brandName={brandName}
          brandLogoUrl={brandLogoUrl}
          campaignId={campaignId}
          campaignName={campaignName}
        />
      </div>

      {/* ── Empty channel labels ──────────────────────────────────────────── */}
      {emptyChannelLabels.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <p style={{
            fontSize: "10px", fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase", letterSpacing: "0.08em",
            marginBottom: "12px",
          }}>
            No assets loaded yet
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {emptyChannelLabels.map(label => (
              <div key={label} style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px dashed var(--color-border)",
                fontSize: "12px", fontWeight: 500,
                color: "var(--color-text-muted)",
                opacity: 0.5,
              }}>
                {label}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
