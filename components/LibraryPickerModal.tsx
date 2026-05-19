"use client";

/**
 * components/LibraryPickerModal.tsx
 *
 * Modal for selecting creatives from the brand's existing creative library
 * and assigning them to a campaign.
 *
 * Props:
 *   brandId      — filters the library to this brand
 *   campaignId   — the campaign to assign selected creatives to
 *   platformFilter — if set, only shows creatives matching this platform
 *   onClose      — dismiss callback
 *   onSuccess    — called after at least one creative is successfully assigned
 */

import { useState, useEffect, useMemo } from "react";
import {
  LibraryBig, Search, X, Loader2, Check, AlertCircle, Film, Image as ImageIcon,
} from "lucide-react";
import type { Creative } from "@/types";

// ── Platform helpers ──────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  youtube:       "YouTube",
  tiktok:        "TikTok",
  landing_page:  "Landing Page",
  pinterest:     "Pinterest",
  meta:          "Meta",
  social:        "Social",
  programmatic:  "Programmatic",
  ooh:           "OOH",
  tvc:           "TVC",
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube:       "#ff0000",
  tiktok:        "#ff0050",
  landing_page:  "#4fb3ba",
  pinterest:     "#e60023",
  meta:          "#1877f2",
  social:        "#a78bfa",
  programmatic:  "#f59e0b",
  ooh:           "#22d3a0",
  tvc:           "#fb923c",
};

function platformLabel(p: string) { return PLATFORM_LABELS[p] ?? p; }
function platformColor(p: string) { return PLATFORM_COLORS[p] ?? "#888"; }

// ── Thumbnail tile ────────────────────────────────────────────────────────────

function CreativeTile({
  item,
  selected,
  onToggle,
}: {
  item: { creative: Creative; brandLogoUrl: string | null };
  selected: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { creative } = item;
  const plColor = platformColor(creative.platform);

  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={creative.title}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        border: selected
          ? `2px solid ${plColor}`
          : hovered
            ? "2px solid rgba(255,255,255,0.2)"
            : "2px solid var(--color-border)",
        borderRadius: 10,
        overflow: "hidden",
        cursor: "pointer",
        background: "var(--color-surface-2)",
        transition: "border-color 150ms, transform 150ms",
        transform: hovered && !selected ? "scale(1.02)" : "scale(1)",
        outline: "none",
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#111", flexShrink: 0 }}>
        {creative.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.thumbnail_url}
            alt={creative.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {creative.ad_type === "image"
              ? <ImageIcon size={24} color="rgba(255,255,255,0.15)" />
              : <Film size={24} color="rgba(255,255,255,0.15)" />
            }
          </div>
        )}

        {/* Platform badge */}
        <span style={{
          position: "absolute", top: 6, left: 6,
          fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          background: `${plColor}cc`, color: "#fff",
          padding: "2px 7px", borderRadius: 10,
          backdropFilter: "blur(4px)",
        }}>
          {platformLabel(creative.platform)}
        </span>

        {/* Selection check overlay */}
        <div style={{
          position: "absolute", inset: 0,
          background: selected ? `${plColor}33` : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 150ms",
        }}>
          {selected && (
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: plColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            }}>
              <Check size={14} color="#fff" strokeWidth={3} />
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: "8px 10px", textAlign: "left" }}>
        <p style={{
          fontSize: 11, fontWeight: 600, color: "var(--color-text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          margin: 0,
        }}>
          {creative.title}
        </p>
        {creative.campaign_name && (
          <p style={{ fontSize: 10, color: "var(--color-text-muted)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {creative.campaign_name}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface Props {
  brandId: string;
  campaignId: string;
  /** If set, pre-filters the library to this platform */
  platformFilter?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function LibraryPickerModal({ brandId, campaignId, platformFilter, onClose, onSuccess }: Props) {
  const [items, setItems]           = useState<{ creative: Creative; brandLogoUrl: string | null }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [platform, setPlatform]     = useState(platformFilter ?? "");
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  // Load brand library (excluding creatives already in this campaign)
  useEffect(() => {
    setLoading(true); setFetchError(null);
    fetch(`/api/brands/${brandId}/creatives?exclude_campaign=${campaignId}`)
      .then(r => r.json())
      .then(d => {
        setItems(d.creatives ?? []);
        setLoading(false);
      })
      .catch(() => { setFetchError("Failed to load creative library."); setLoading(false); });
  }, [brandId, campaignId]);

  // Available platform options from the loaded library
  const availablePlatforms = useMemo(() => {
    const set = new Set(items.map(i => i.creative.platform));
    return Array.from(set).sort();
  }, [items]);

  // Filtered + searched results
  const filtered = useMemo(() => {
    return items.filter(i => {
      if (platform && i.creative.platform !== platform) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          i.creative.title.toLowerCase().includes(q) ||
          i.creative.platform.toLowerCase().includes(q) ||
          (i.creative.campaign_name ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, platform, search]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssign() {
    if (selected.size === 0 || saving) return;
    setSaving(true); setSaveError(null);
    const ids = Array.from(selected);
    try {
      const results = await Promise.all(
        ids.map(creativeId =>
          fetch(`/api/creatives/${creativeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaign_id: campaignId }),
          }).then(r => r.json())
        )
      );
      const failed = results.filter(r => !r.updated);
      if (failed.length > 0) {
        setSaveError(`${failed.length} creative(s) could not be assigned.`);
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setSaveError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick from library"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 18,
          width: "100%", maxWidth: 780,
          maxHeight: "88vh",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          animation: "libraryModalIn 220ms cubic-bezier(0.34,1.4,0.64,1) both",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 22px 16px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9,
              background: "rgba(79,179,186,0.12)",
              border: "1px solid rgba(79,179,186,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <LibraryBig size={17} color="var(--color-accent)" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", margin: 0 }}>
                Add from Library
              </p>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: 0 }}>
                Select existing creatives to add to this campaign
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 30, height: 30, borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "none", cursor: "pointer",
              color: "var(--color-text-muted)",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: "14px 22px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex", alignItems: "center", gap: 10,
          flexShrink: 0, flexWrap: "wrap",
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Search size={13} color="var(--color-text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search creatives…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box",
                paddingLeft: 30, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: 8, fontSize: 12,
                color: "var(--color-text-primary)", outline: "none",
              }}
            />
          </div>

          {/* Platform filter pills */}
          {availablePlatforms.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button
                onClick={() => setPlatform("")}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  border: `1px solid ${platform === "" ? "var(--color-accent)" : "var(--color-border)"}`,
                  background: platform === "" ? "rgba(79,179,186,0.12)" : "transparent",
                  color: platform === "" ? "var(--color-accent)" : "var(--color-text-muted)",
                  transition: "all 150ms",
                }}
              >All</button>
              {availablePlatforms.map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(prev => prev === p ? "" : p)}
                  style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${platform === p ? platformColor(p) : "var(--color-border)"}`,
                    background: platform === p ? `${platformColor(p)}22` : "transparent",
                    color: platform === p ? platformColor(p) : "var(--color-text-muted)",
                    transition: "all 150ms",
                  }}
                >{platformLabel(p)}</button>
              ))}
            </div>
          )}
        </div>

        {/* Grid body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, gap: 10 }}>
              <Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
              <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Loading library…</span>
            </div>
          ) : fetchError ? (
            <div style={{ display: "flex", gap: 8, padding: 14, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
              <AlertCircle size={14} color="#f43f5e" />
              <p style={{ fontSize: 13, color: "#f43f5e", margin: 0 }}>{fetchError}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <LibraryBig size={32} color="var(--color-text-muted)" style={{ margin: "0 auto 12px", opacity: 0.4 }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>
                {items.length === 0 ? "No other creatives in this brand's library" : "No creatives match your filter"}
              </p>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {items.length === 0
                  ? "All brand creatives are already in this campaign, or none have been ingested yet."
                  : "Try a different search term or platform filter."}
              </p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: 12,
            }}>
              {filtered.map(item => (
                <CreativeTile
                  key={item.creative.id}
                  item={item}
                  selected={selected.has(item.creative.id)}
                  onToggle={() => toggleSelect(item.creative.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 22px",
          borderTop: "1px solid var(--color-border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {selected.size === 0
              ? `${filtered.length} creative${filtered.length !== 1 ? "s" : ""} available`
              : <span style={{ color: "var(--color-accent)", fontWeight: 600 }}>{selected.size} selected</span>
            }
          </div>

          {saveError && (
            <p style={{ fontSize: 12, color: "#f43f5e", margin: 0, flex: 1 }}>{saveError}</p>
          )}

          <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding: "9px 18px", borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "none", color: "var(--color-text-secondary)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                opacity: saving ? 0.4 : 1,
              }}
            >Cancel</button>
            <button
              onClick={handleAssign}
              disabled={selected.size === 0 || saving}
              style={{
                padding: "9px 22px", borderRadius: 8, border: "none",
                background: selected.size > 0 ? "linear-gradient(135deg, var(--color-accent), #22d3a0)" : "var(--color-surface-2)",
                color: selected.size > 0 ? "#0a1a1b" : "var(--color-text-muted)",
                fontSize: 13, fontWeight: 700,
                cursor: selected.size > 0 && !saving ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 7,
                transition: "all 200ms",
                opacity: selected.size === 0 ? 0.5 : 1,
              }}
            >
              {saving
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Adding…</>
                : <><Check size={13} /> Add {selected.size > 0 ? `${selected.size} ` : ""}to Campaign</>
              }
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes libraryModalIn {
          from { opacity: 0; transform: scale(0.94) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
