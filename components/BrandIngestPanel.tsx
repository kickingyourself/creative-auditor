"use client";

import { useState } from "react";
import { Globe, PlayCircle } from "lucide-react";
import { ScrapeForm } from "@/components/ScrapeForm";
import { YouTubeIngestForm } from "@/components/YouTubeIngestForm";
import { FacebookIngestForm } from "@/components/FacebookIngestForm";
import { InstagramIngestForm } from "@/components/InstagramIngestForm";

// ─── Brand SVG icons (lucide-react doesn't ship Facebook/Instagram) ───────────
function FbIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}
function IgIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

type Platform = "homepage" | "youtube" | "facebook" | "instagram";

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
  {
    id: "facebook",
    label: "Facebook",
    icon: <FbIcon size={13} />,
    color: "var(--color-text-secondary)",
    activeColor: "#1877f2",
    activeBg: "rgba(24,119,242,0.10)",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: <IgIcon size={13} />,
    color: "var(--color-text-secondary)",
    activeColor: "#e1306c",
    activeBg: "rgba(225,48,108,0.10)",
  },
];

interface BrandIngestPanelProps {
  brandId: string;
  brandName?: string;
}

export function BrandIngestPanel({ brandId, brandName }: BrandIngestPanelProps) {
  const [active, setActive] = useState<Platform>("homepage");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Tab switcher — wraps on small screens */}
      <div
        role="tablist"
        aria-label={`Ingest platform for ${brandName ?? brandId}`}
        style={{
          display: "flex",
          flexWrap: "wrap",
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
                boxShadow: isActive ? `0 0 0 1px ${tab.activeColor}30` : "none",
                whiteSpace: "nowrap",
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
        {active === "homepage" && <ScrapeForm brandId={brandId} brandName={brandName} />}
        {active === "youtube" && <YouTubeIngestForm brandId={brandId} brandName={brandName} />}
        {active === "facebook" && <FacebookIngestForm brandId={brandId} brandName={brandName} />}
        {active === "instagram" && <InstagramIngestForm brandId={brandId} brandName={brandName} />}
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
