"use client";

import { useState } from "react";
import { Globe, PlayCircle } from "lucide-react";
import { ScrapeForm } from "@/components/ScrapeForm";
import { YouTubeIngestForm } from "@/components/YouTubeIngestForm";

type Platform = "homepage" | "youtube";

interface Tab {
  id: Platform;
  label: string;
  icon: React.ReactNode;
  color: string;
  activeColor: string;
  activeBg: string;
}

const TABS: Tab[] = [
  {
    id: "homepage",
    label: "Homepage",
    icon: <Globe size={13} />,
    color: "var(--color-text-secondary)",
    activeColor: "#22d3a0",
    activeBg: "rgba(34,211,160,0.10)",
  },
  {
    id: "youtube",
    label: "YouTube",
    icon: <PlayCircle size={13} />,
    color: "var(--color-text-secondary)",
    activeColor: "#ff4444",
    activeBg: "rgba(255,68,68,0.10)",
  },
];

interface BrandIngestPanelProps {
  brandId: string;
  brandName?: string;
}

export function BrandIngestPanel({ brandId, brandName }: BrandIngestPanelProps) {
  const [active, setActive] = useState<Platform>("homepage");

  const activeTab = TABS.find((t) => t.id === active)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label={`Ingest platform for ${brandName ?? brandId}`}
        style={{
          display: "inline-flex",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "10px",
          padding: "4px",
          gap: "2px",
        }}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}-${brandId}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "7px",
                border: "none",
                fontSize: "12px",
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                transition: "all 150ms ease",
                background: isActive ? tab.activeBg : "transparent",
                color: isActive ? tab.activeColor : tab.color,
                boxShadow: isActive
                  ? `0 0 0 1px ${tab.activeColor}30`
                  : "none",
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active form — keyed by brandId+platform to fully reset state on switch */}
      <div
        role="tabpanel"
        aria-labelledby={`tab-${active}-${brandId}`}
        key={`${brandId}-${active}`}
        style={{ animation: "fadeInUp 0.2s ease both" }}
      >
        {active === "homepage" && (
          <ScrapeForm brandId={brandId} brandName={brandName} />
        )}
        {active === "youtube" && (
          <YouTubeIngestForm brandId={brandId} brandName={brandName} />
        )}
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
