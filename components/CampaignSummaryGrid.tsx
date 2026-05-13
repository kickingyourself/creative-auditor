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
import Link from "next/link";

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
  youtube:      { color: "#ff4444", bg: "rgba(255,68,68,0.12)",    label: "YouTube"       },
  tiktok:       { color: "#69c9d0", bg: "rgba(105,201,208,0.12)", label: "TikTok"        },
  landing_page: { color: "#22d3a0", bg: "rgba(34,211,160,0.12)",  label: "Landing Page"  },
  homepage:     { color: "#22d3a0", bg: "rgba(34,211,160,0.12)",  label: "Landing Page"  },
  pinterest:    { color: "#e60023", bg: "rgba(230,0,35,0.12)",    label: "Pinterest"     },
  instagram:    { color: "#e1306c", bg: "rgba(225,48,108,0.12)",  label: "Instagram"     },
  facebook:     { color: "#1877f2", bg: "rgba(24,119,242,0.12)",  label: "Facebook"      },
  meta:         { color: "#1877f2", bg: "rgba(24,119,242,0.12)",  label: "Meta"          },
  social:       { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", label: "Social"        },
  programmatic: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Programmatic"  },
  ooh:          { color: "#06b6d4", bg: "rgba(6,182,212,0.12)",   label: "OOH"           },
  tvc:          { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)",  label: "TVC"           },
  website:      { color: "#fb923c", bg: "rgba(251,146,60,0.12)",  label: "Website"       },
};

function platformStyle(p: string) {
  return PLATFORM_COLORS[p] ?? {
    color: "#9a9990",
    bg: "rgba(154,153,144,0.12)",
    label: p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  };
}

// ── Tile ──────────────────────────────────────────────────────────────────────

function SummaryTile({ s }: { s: CampaignSummary }) {
  const thumbs = [...s.thumbnails, null, null, null, null].slice(0, 4);
  const isUncategorised = s.campaign_id === null;

  const card = (
    <article
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "14px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 200ms ease",
        cursor: isUncategorised ? "default" : "pointer",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        if (!isUncategorised) {
          (e.currentTarget as HTMLElement).style.borderColor = "rgba(34,211,160,0.45)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--color-border)";
      }}
    >
      {/* ── Thumbnail mosaic ── 4 quadrants, absolutely positioned so portrait images can't break the 1:1 shape */}
      <div style={{ position: "relative", width: "100%", paddingBottom: "100%", flexShrink: 0, overflow: "hidden", background: "var(--color-surface-2)" }}>
        {thumbs.map((url, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top:    i < 2 ? 0 : "50%",
              left:   i % 2 === 0 ? 0 : "50%",
              width:  "50%",
              height: "50%",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-surface-2)",
            }}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <ImageIcon size={18} color="var(--color-border)" />
            )}
          </div>
        ))}
      </div>

      {/* ── Info ── */}
      <div style={{
        padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: "10px",
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        flexShrink: 0,
      }}>

        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          {s.brand_logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.brand_logo_url}
              alt={s.brand_name}
              style={{ width: 20, height: 20, borderRadius: 4, objectFit: "contain", flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 20, height: 20, borderRadius: 4, flexShrink: 0,
              background: "var(--color-accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "#0a1a1b",
            }}>
              {s.brand_name[0]?.toUpperCase()}
            </div>
          )}
          <span style={{
            fontSize: "12px", fontWeight: 700,
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
            fontSize: "14px",
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
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}>
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

  // Named campaigns are clickable; uncategorised tiles are not
  if (!isUncategorised && s.campaign_id) {
    return (
      <Link
        href={`/campaigns/${s.campaign_id}`}
        style={{ textDecoration: "none", display: "block", borderRadius: "14px" }}
      >
        {card}
      </Link>
    );
  }
  return card;
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
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "18px",
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
