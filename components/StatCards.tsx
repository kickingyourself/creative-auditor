"use client";

import { Film, Eye, Building2, TrendingUp } from "lucide-react";

export interface StatCardsData {
  totalCreatives: number;
  totalBrands: number;
  totalViews: number;
  topPlatform: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Blinking cursor character to sell the "live terminal" look */
function Cursor() {
  return (
    <span style={{ animation: "blink 1.1s step-end infinite", opacity: 1, color: "var(--color-accent)" }}>
      ▮
    </span>
  );
}

export function StatCards({ data }: { data: StatCardsData }) {
  const stats = [
    {
      id:    "stat-total-creatives",
      label: "CREATIVES",
      value: fmt(data.totalCreatives),
      icon:  Film,
      color: "#4fb3ba",
      delta: "+2.4%",
      up:    true,
    },
    {
      id:    "stat-total-brands",
      label: "BRANDS",
      value: fmt(data.totalBrands),
      icon:  Building2,
      color: "#38bdf8",
      delta: "+0.8%",
      up:    true,
    },
    {
      id:    "stat-total-views",
      label: "TOTAL VIEWS",
      value: fmt(data.totalViews),
      icon:  Eye,
      color: "#22d3a0",
      delta: "+5.1%",
      up:    true,
    },
    {
      id:    "stat-top-platform",
      label: "TOP PLATFORM",
      value: data.topPlatform || "—",
      icon:  TrendingUp,
      color: "#f59e0b",
      delta: "LEAD",
      up:    true,
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
              gap: "5px",
              padding: "10px 16px",
              borderRight: i < stats.length - 1 ? "1px solid var(--color-border)" : "none",
              /* Subtle left accent bar via box-shadow */
              boxShadow: `inset 3px 0 0 ${stat.color}`,
            }}
          >
            {/* Label row */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}>
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

            {/* Value + delta on one line */}
            <div style={{
              display: "flex",
              alignItems: "baseline",
              gap: "8px",
            }}>
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

              <span style={{
                fontSize: "10px",
                fontWeight: 600,
                color: stat.up ? "#22d3a0" : "#f43f5e",
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}>
                {stat.up ? "▲" : "▼"} {stat.delta}
              </span>

              {/* Blinking cursor on the last (most "live") cell */}
              {i === 2 && <Cursor />}
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }

        @media (max-width: 640px) {
          .stat-strip {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
          }
          .stat-cell {
            border-right: none !important;
            flex: unset;
          }
          .stat-cell-1, .stat-cell-3 {
            border-left: 1px solid var(--color-border);
          }
          .stat-cell-0, .stat-cell-1 {
            border-bottom: 1px solid var(--color-border);
          }
        }
      `}</style>
    </div>
  );
}
