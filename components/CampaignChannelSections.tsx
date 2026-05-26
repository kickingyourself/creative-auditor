"use client";

/**
 * components/CampaignChannelSections.tsx
 *
 * Renders: hero banner → filled channel sections (with inline Add tile) → empty channel strip.
 * Owns heroCreativeId state with optimistic DB sync.
 */

import { useState, useCallback, useEffect } from "react";
import { Layers, Crown, Plus } from "lucide-react";
import { Creative } from "@/types";
import { SortableCreativeGrid } from "@/components/SortableCreativeGrid";

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
  initialHeroCreativeId: string | null;
  /** Per-channel add handlers — key = channel key (e.g. "youtube"), value = open-modal fn */
  onAddCreative?: Record<string, (() => void) | undefined>;
}

// ── Inline add tile ───────────────────────────────────────────────────────────

function AddTile({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: 160, border: `1.5px dashed ${hovered ? "var(--color-accent)" : "var(--color-border)"}`, borderRadius: 12, background: hovered ? "rgba(79,179,186,0.04)" : "transparent", cursor: "pointer", transition: "all 200ms", outline: "none" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px dashed ${hovered ? "rgba(79,179,186,0.6)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Plus size={16} strokeWidth={1.8} color={hovered ? "var(--color-accent)" : "rgba(255,255,255,0.2)"} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: hovered ? "var(--color-accent)" : "rgba(255,255,255,0.18)", transition: "color 200ms" }}>Add creative</span>
    </button>
  );
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
      <div style={{ borderRadius: "16px", overflow: "hidden", border: "1.5px solid rgba(251,191,36,0.65)", position: "relative" }}>
        {creative.thumbnail_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={creative.thumbnail_url} alt={creative.title ?? ""} style={{ width: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "320px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: "14px" }}>No preview available</div>
        }
        <div style={{ position: "absolute", top: 14, left: 14, display: "flex", alignItems: "center", gap: "6px", background: "rgba(251,191,36,0.9)", backdropFilter: "blur(8px)", padding: "4px 10px", borderRadius: "20px" }}>
          <Crown size={10} color="#1a1a1a" fill="#1a1a1a" />
          <span style={{ fontSize: "10px", fontWeight: 700, color: "#1a1a1a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Hero</span>
        </div>
        <span style={{ position: "absolute", top: 14, right: 14, fontSize: "10px", fontWeight: 700, background: "rgba(0,0,0,0.6)", color: "#fff", backdropFilter: "blur(8px)", padding: "4px 10px", borderRadius: "20px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {platformLabel}
        </span>
      </div>
      {creative.title && <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "10px" }}>{creative.title}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CampaignChannelSections({
  filledChannels, emptyChannelLabels, allCreatives,
  campaignId, campaignName: _cn, brandId: _bi, brandName: _bn, brandLogoUrl: _bl,
  initialHeroCreativeId, onAddCreative,
}: Props) {
  const HERO_KEY = `campaign-hero-${campaignId}`;
  const [heroCreativeId, setHeroCreativeId] = useState<string | null>(initialHeroCreativeId);
  const [togglingId, setTogglingId]         = useState<string | null>(null);

  useEffect(() => {
    if (initialHeroCreativeId !== null) { localStorage.removeItem(HERO_KEY); }
    else { const s = localStorage.getItem(HERO_KEY); if (s) setHeroCreativeId(s); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const heroItem =
    (heroCreativeId ? allCreatives.find(c => c.creative.id === heroCreativeId) : null) ??
    allCreatives.find(c => c.creative.platform === "landing_page") ?? undefined;

  const handleToggleHero = useCallback(async (creativeId: string) => {
    if (togglingId) return;
    const newHeroId = heroCreativeId === creativeId ? null : creativeId;
    setHeroCreativeId(newHeroId); setTogglingId(creativeId);
    if (newHeroId) localStorage.setItem(HERO_KEY, newHeroId);
    else localStorage.removeItem(HERO_KEY);
    try {
      await fetch(`/api/campaigns/${campaignId}/hero`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creative_id: newHeroId }),
      });
    } catch {
      setHeroCreativeId(heroCreativeId);
      if (heroCreativeId) localStorage.setItem(HERO_KEY, heroCreativeId);
      else localStorage.removeItem(HERO_KEY);
    } finally { setTogglingId(null); }
  }, [campaignId, heroCreativeId, togglingId, HERO_KEY]);

  return (
    <>
      {/* Hero banner */}
      <HeroBanner item={heroItem} />

      {/* Filled channel sections — CreativeGrid + inline Add tile */}
      {filledChannels.map(ch => {
        const addHandler = onAddCreative?.[ch.key];
        return (
          <section key={ch.key} style={{ marginBottom: "48px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Layers size={14} color="var(--color-accent)" />
              <h2 style={{ fontSize: "16px", fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>{ch.label}</h2>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-accent)", background: "rgba(79,179,186,0.1)", border: "1px solid rgba(79,179,186,0.2)", padding: "2px 8px", borderRadius: "20px" }}>{ch.items.length}</span>
            </div>
            <SortableCreativeGrid
              items={ch.items}
              campaignId={campaignId}
              platform={ch.key}
              heroCreativeId={heroCreativeId}
              onToggleHero={handleToggleHero}
              appendSlot={addHandler ? <AddTile onClick={addHandler} /> : undefined}
            />
          </section>
        );
      })}

      {/* Empty channels — clickable if handler available, greyed otherwise */}
      {emptyChannelLabels.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <p style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>No assets loaded yet</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {emptyChannelLabels.map(label => {
              const key = label.toLowerCase().replace(/\s+/g, "_");
              const addHandler = onAddCreative?.[key];
              return addHandler ? (
                <button key={label} onClick={addHandler} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px dashed var(--color-accent)", fontSize: "12px", fontWeight: 500, color: "var(--color-accent)", background: "rgba(79,179,186,0.04)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Plus size={11} /> {label}
                </button>
              ) : (
                <div key={label} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px dashed var(--color-border)", fontSize: "12px", fontWeight: 500, color: "var(--color-text-muted)", opacity: 0.5 }}>{label}</div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
