"use client";

import { Film, Eye, Building2, TrendingUp } from "lucide-react";

export interface StatCardsData {
  totalCreatives: number;
  totalBrands: number;
  totalViews: number;
  topPlatform: string;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function StatCards({ data }: { data: StatCardsData }) {
  const stats = [
    { id: "stat-total-creatives", label: "Creatives",    value: fmt(data.totalCreatives), icon: Film,       color: "#4fb3ba" },
    { id: "stat-total-brands",    label: "Brands",       value: fmt(data.totalBrands),    icon: Building2,  color: "#38bdf8" },
    { id: "stat-total-views",     label: "Total Views",  value: fmt(data.totalViews),     icon: Eye,        color: "#22d3a0" },
    { id: "stat-top-platform",    label: "Top Platform", value: data.topPlatform || "—",  icon: TrendingUp, color: "#f59e0b" },
  ];

  return (
    <div
      id="stat-strip"
      className="stat-strip"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "10px",
        marginBottom: "24px",
        overflow: "hidden",
      }}
    >
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            id={stat.id}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 18px",
              borderRight: i < stats.length - 1 ? "1px solid var(--color-border)" : "none",
            }}
            className={`stat-cell stat-cell-${i}`}
          >
            <Icon size={13} color={stat.color} style={{ flexShrink: 0, opacity: 0.8 }} />
            <div>
              <p style={{
                fontSize: "10px",
                fontWeight: 500,
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                lineHeight: 1,
                marginBottom: "3px",
              }}>
                {stat.label}
              </p>
              <p style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                textTransform: "capitalize",
              }}>
                {stat.value}
              </p>
            </div>
          </div>
        );
      })}

      <style>{`
        @media (max-width: 640px) {
          .stat-strip {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
          }
          .stat-cell {
            border-right: none !important;
            flex: unset;
          }
          /* Right column cells get a left border */
          .stat-cell-1, .stat-cell-3 {
            border-left: 1px solid var(--color-border);
          }
          /* Top two cells get a bottom border */
          .stat-cell-0, .stat-cell-1 {
            border-bottom: 1px solid var(--color-border);
          }
        }
      `}</style>
    </div>
  );
}
