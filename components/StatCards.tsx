"use client";

import { Film, Eye, Building2, TrendingUp, ArrowUpRight } from "lucide-react";

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
    {
      id: "stat-total-creatives",
      label: "Total Creatives",
      value: fmt(data.totalCreatives),
      sub: "ingested",
      icon: Film,
      color: "#4fb3ba",
      bg: "rgba(79,179,186,0.1)",
    },
    {
      id: "stat-total-brands",
      label: "Brands Tracked",
      value: fmt(data.totalBrands),
      sub: "active",
      icon: Building2,
      color: "#38bdf8",
      bg: "rgba(56, 189, 248, 0.1)",
    },
    {
      id: "stat-total-views",
      label: "Total Views",
      value: fmt(data.totalViews),
      sub: "across all platforms",
      icon: Eye,
      color: "#22d3a0",
      bg: "rgba(34, 211, 160, 0.1)",
    },
    {
      id: "stat-top-platform",
      label: "Top Platform",
      value: data.topPlatform || "—",
      sub: "by creative count",
      icon: TrendingUp,
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.1)",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px",
        marginBottom: "32px",
      }}
    >
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.id}
            id={stat.id}
            className="animate-fade-in-up"
            style={{
              animationDelay: `${i * 70}ms`,
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "14px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              cursor: "default",
              transition: "transform 200ms ease, box-shadow 200ms ease",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(-2px)";
              el.style.boxShadow = `0 8px 24px ${stat.color}18`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "none";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{
                fontSize: "12px", fontWeight: 500,
                color: "var(--color-text-secondary)",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                {stat.label}
              </p>
              <div style={{
                width: 32, height: 32, borderRadius: "8px",
                background: stat.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={15} color={stat.color} />
              </div>
            </div>
            <div>
              <p style={{
                fontSize: "28px", fontWeight: 800,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.04em", lineHeight: 1,
                textTransform: "capitalize",
              }}>
                {stat.value}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "6px" }}>
                <ArrowUpRight size={12} color="#22d3a0" />
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  {stat.sub}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
