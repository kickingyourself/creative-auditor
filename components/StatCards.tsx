"use client";

import { Film, Clock, Building2, TrendingUp, Database } from "lucide-react";

export interface StatCardsData {
  totalCreatives: number;
  totalBrands: number;
  latestUploadAt: string | null;   // ISO timestamp of the most recently ingested creative
  topPlatform: string;
  totalCampaigns: number;          // Total number of campaigns
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Relative time: "2h ago", "just now", "3d ago" */
function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)          return "just now";
  const m = Math.floor(s / 60);
  if (m < 60)          return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)          return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Short absolute timestamp: "13 May 00:04" */
function shortTs(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/** Blinking cursor to sell the live-terminal feel */
function Cursor() {
  return (
    <span
      aria-hidden
      style={{ animation: "blink 1.1s step-end infinite", color: "var(--color-accent)" }}
    >
      ▮
    </span>
  );
}

export function StatCards({ data }: { data: StatCardsData }) {
  const stats = [
    {
      id:      "stat-total-creatives",
      label:   "CREATIVES",
      value:   fmt(data.totalCreatives),
      sub:     null,
      icon:    Film,
      color:   "#4fb3ba",
      cursor:  false,
    },
    {
      id:      "stat-total-brands",
      label:   "BRANDS",
      value:   fmt(data.totalBrands),
      sub:     null,
      icon:    Building2,
      color:   "#38bdf8",
      cursor:  false,
    },
    {
      id:      "stat-top-platform",
      label:   "TOP PLATFORM",
      value:   data.topPlatform || "—",
      sub:     null,
      icon:    TrendingUp,
      color:   "#f59e0b",
      cursor:  false,
    },
    {
      id:      "stat-total-campaigns",
      label:   "CAMPAIGNS",
      value:   fmt(data.totalCampaigns),
      sub:     null,
      icon:    Database,
      color:   "#a78bfa",
      cursor:  false,
    },
    {
      id:      "stat-latest-upload",
      label:   "LATEST UPLOAD",
      value:   relativeTime(data.latestUploadAt),
      sub:     shortTs(data.latestUploadAt),
      icon:    Clock,
      color:   "#22d3a0",
      cursor:  true,
    },
  ];

  return (
    <div
      id="stat-strip"
      className="stat-strip"
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "10px",
        marginBottom: "24px",
        overflow: "hidden",
        fontFamily: "var(--font-geist-mono), 'Courier New', monospace",
      }}
    >
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            id={stat.id}
            className={`stat-cell stat-cell-${i}`}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "4px",
              padding: "10px 16px",
              borderRight: i < stats.length - 1 ? "1px solid var(--color-border)" : "none",
            }}
          >
            {/* Label row */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Icon size={9} color={stat.color} style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "var(--color-text-muted)",
                letterSpacing: "0.12em",
              }}>
                {stat.label}
              </span>
            </div>

            {/* Value row */}
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span style={{
                fontSize: "17px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.03em",
                lineHeight: 1,
                textTransform: "capitalize",
              }}>
                {stat.value}
              </span>
              {stat.cursor && <Cursor />}
            </div>

            {/* Sub-label (e.g. absolute timestamp under relative) */}
            {stat.sub && (
              <span style={{
                fontSize: "9px",
                color: "var(--color-text-muted)",
                letterSpacing: "0.05em",
                lineHeight: 1,
              }}>
                {stat.sub}
              </span>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        @media (max-width: 800px) {
          .stat-strip {
            display: grid !important;
            grid-template-columns: 1fr 1fr 1fr;
          }
          .stat-cell {
            border-right: none !important;
            flex: unset;
          }
          .stat-cell-1, .stat-cell-3 { border-left: 1px solid var(--color-border); }
          .stat-cell-2               { border-left: 1px solid var(--color-border); }
          .stat-cell-0, .stat-cell-1, .stat-cell-2 {
            border-bottom: 1px solid var(--color-border);
          }
        }

        @media (max-width: 540px) {
          .stat-strip {
            grid-template-columns: 1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
