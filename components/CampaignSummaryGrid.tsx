"use client";

/**
 * components/CampaignSummaryGrid.tsx
 *
 * Renders a grid of Brand + Campaign summary tiles.
 * Each tile shows: brand name/logo, campaign name (or "Uncategorised"),
 * a 2×2 thumbnail mosaic, a creative count, and a platform breakdown.
 *
 * Data is passed in as a pre-computed array from the server (page.tsx).
 */

import { Layers, ImageIcon } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CampaignSummary {
  brand_id: string;
  brand_name: string;
  brand_logo_url: string | null;
  campaign_id: string | null;          // null → "Uncategorised"
  campaign_name: string | null;
  creative_count: number;
  thumbnails: (string | null)[];       // up to 4
  platforms: string[];                 // deduplicated list
}

interface Props {
  summaries: CampaignSummary[];
}

// ── Platform colour map (matches CreativeCard) ────────────────────────────────

const PLATFORM_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  youtube:  { color: "#ff4444", bg: "rgba(255,68,68,0.12)",   label: "YouTube"  },
  tiktok:   { color: "#ff0050", bg: "rgba(255,0,80,0.12)",    label: "TikTok"   },
  homepage: { color: "#22d3a0", bg: "rgba(34,211,160,0.12)",  label: "Homepage" },
  meta:     { color: "#0ea5e9", bg: "rgba(14,165,233,0.12)",  label: "Meta"     },
  social:   { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", label: "Social"   },
  website:  { color: "#fb923c", bg: "rgba(251,146,60,0.12)",  label: "Website"  },
  other:    { color: "#9a9990", bg: "rgba(154,153,144,0.12)", label: "Other"    },
};

function platformStyle(p: string) {
  return PLATFORM_COLORS[p] ?? PLATFORM_COLORS.other;
}

// ── Tile ──────────────────────────────────────────────────────────────────────

function SummaryTile({ s }: { s: CampaignSummary }) {
  const thumbs = [...s.thumbnails, null, null, null, null].slice(0, 4);
  const isUncategorised = s.campaign_id === null;

  return (
    <article
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "14px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 200ms ease, box-shadow 200ms ease",
        cursor: "default",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-accent)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(34,211,160,0.12)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* ── Thumbnail mosaic ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "80px 80px",
          background: "var(--color-surface-2)",
          gap: "1px",
        }}
      >
        {thumbs.map((url, i) =>
          url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div
              key={i}
              style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--color-surface-2)",
              }}
            >
              <ImageIcon size={18} color="var(--color-border)" />
            </div>
          )
        )}
      </div>

      {/* ── Info ── */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>

        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          {s.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.brand_logo_url}
              alt={s.brand_name}
              style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain", flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 18, height: 18, borderRadius: 4, flexShrink: 0,
              background: "var(--color-accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 800, color: "#0a1a1b",
            }}>
              {s.brand_name[0]?.toUpperCase()}
            </div>
          )}
          <span style={{
            fontSize: "11px", fontWeight: 700,
            color: "var(--color-text-secondary)",
            textTransform: "uppercase", letterSpacing: "0.05em",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {s.brand_name}
          </span>
        </div>

        {/* Campaign name */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Layers
            size={12}
            color={isUncategorised ? "var(--color-text-muted)" : "var(--color-accent)"}
            style={{ flexShrink: 0 }}
          />
          <span style={{
            fontSize: "13px",
            fontWeight: isUncategorised ? 400 : 600,
            color: isUncategorised ? "var(--color-text-muted)" : "var(--color-text-primary)",
            fontStyle: isUncategorised ? "italic" : "normal",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {s.campaign_name ?? "Uncategorised"}
          </span>
        </div>

        {/* Footer: count + platform pills */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px",
          marginTop: "2px",
        }}>
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontWeight: 500 }}>
            {s.creative_count} creative{s.creative_count !== 1 ? "s" : ""}
          </span>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {s.platforms.slice(0, 3).map((p) => {
              const ps = platformStyle(p);
              return (
                <span key={p} style={{
                  fontSize: "9px", fontWeight: 600,
                  color: ps.color, background: ps.bg,
                  borderRadius: "4px", padding: "2px 6px",
                  textTransform: "capitalize",
                }}>
                  {ps.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

// ── Grid ──────────────────────────────────────────────────────────────────────

export function CampaignSummaryGrid({ summaries }: Props) {
  if (summaries.length === 0) return null;

  return (
    <section style={{ marginBottom: "40px" }}>
      {/* Section header */}
      <div style={{ marginBottom: "16px" }}>
        <h2 style={{
          fontSize: "16px", fontWeight: 700,
          color: "var(--color-text-primary)", letterSpacing: "-0.02em",
        }}>
          Brand &amp; Campaign Overview
        </h2>
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
          {summaries.length} brand–campaign group{summaries.length !== 1 ? "s" : ""} across your library
        </p>
      </div>

      {/* Tiles */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "16px",
      }}>
        {summaries.map((s) => (
          <SummaryTile
            key={`${s.brand_id}-${s.campaign_id ?? "uncategorised"}`}
            s={s}
          />
        ))}
      </div>
    </section>
  );
}
