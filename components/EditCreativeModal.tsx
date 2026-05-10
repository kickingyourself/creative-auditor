"use client";

/**
 * components/EditCreativeModal.tsx
 *
 * Slide-in sheet for editing a creative's metadata:
 *   • Brand  (select from all brands)
 *   • Title  (free text; blank = derived from URL)
 *   • Date   (the creative's created_at timestamp)
 *   • Campaign ID (UUID text field; blank = no campaign)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Creative } from "@/types";
import {
  X,
  Save,
  Loader2,
  AlertTriangle,
  Tag,
  Calendar,
  Layers,
  CheckCircle2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandOption {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface EditCreativePayload {
  brand_id:    string;
  title:       string | null;
  created_at:  string;
  campaign_id: string | null;
}

interface Props {
  creative: Creative;
  onClose: () => void;
  /** Called with updated fields so the grid can optimistically patch local state. */
  onSave: (id: string, patch: EditCreativePayload & { brand_name?: string }) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts an ISO timestamp to the local YYYY-MM-DD string for <input type="date"> */
function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

/** Converts a YYYY-MM-DD date-input value back to an ISO string at midnight UTC. */
function dateInputToIso(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EditCreativeModal({ creative, onClose, onSave }: Props) {
  // Form fields
  const [brandId,    setBrandId]    = useState(creative.brand_id);
  const [title,      setTitle]      = useState(creative.title ?? "");
  const [dateValue,  setDateValue]  = useState(isoToDateInput(creative.created_at));
  const [campaignId, setCampaignId] = useState(creative.campaign_id ?? "");

  // Brands list for the select
  const [brands,         setBrands]         = useState<BrandOption[]>([]);
  const [brandsLoading,  setBrandsLoading]  = useState(true);

  // Submission state
  const [isSaving,  setIsSaving]  = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Fetch brand list on mount ─────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data) => {
        if (active) setBrands(data.brands ?? []);
      })
      .catch(() => { /* silent — brand select will be disabled */ })
      .finally(() => { if (active) setBrandsLoading(false); });
    return () => { active = false; };
  }, []);

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSaving, onClose]);

  // ── Click-outside to close ────────────────────────────────────────────────
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !isSaving) onClose();
  }, [isSaving, onClose]);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    const payload: EditCreativePayload = {
      brand_id:    brandId,
      title:       title.trim() || null,
      created_at:  dateInputToIso(dateValue),
      campaign_id: campaignId.trim() || null,
    };

    try {
      const res  = await fetch(`/api/creatives/${creative.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveError(json?.detail ?? json?.error ?? "Save failed.");
        setIsSaving(false);
        return;
      }

      // Find selected brand name for optimistic update
      const selectedBrand = brands.find((b) => b.id === brandId);
      setSaved(true);
      onSave(creative.id, { ...payload, brand_name: selectedBrand?.name });

      // Auto-close after brief success flash
      setTimeout(onClose, 900);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error.");
      setIsSaving(false);
    }
  }

  const isDirty =
    brandId    !== creative.brand_id          ||
    (title.trim() || null) !== (creative.title ?? null) ||
    dateValue  !== isoToDateInput(creative.created_at) ||
    (campaignId.trim() || null) !== (creative.campaign_id ?? null);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Edit creative"
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      {/* Slide-in panel */}
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          height: "100%",
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          animation: "editPanelIn 260ms cubic-bezier(0.22,1,0.36,1) both",
          boxShadow: "-24px 0 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.2 }}>
              Edit Creative
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3 }}>
              Update metadata for this asset
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            id={`edit-creative-close-${creative.id}`}
            aria-label="Close edit panel"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 8,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.4 : 1,
              transition: "background 150ms",
            }}
          >
            <X size={15} color="var(--color-text-secondary)" />
          </button>
        </div>

        {/* ── Thumbnail preview strip ── */}
        {creative.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.thumbnail_url}
            alt=""
            style={{
              width: "100%", height: 140,
              objectFit: "cover", flexShrink: 0,
              borderBottom: "1px solid var(--color-border)",
            }}
          />
        )}

        {/* ── Form fields ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Brand */}
            <FieldGroup icon={<Layers size={14} />} label="Brand">
              <select
                id={`edit-brand-${creative.id}`}
                value={brandId}
                onChange={(e) => { setBrandId(e.target.value); setCampaignId(""); }}
                disabled={brandsLoading || isSaving}
                style={selectStyle}
              >
                {brandsLoading ? (
                  <option value="">Loading brands…</option>
                ) : (
                  brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))
                )}
              </select>
            </FieldGroup>

            {/* Title */}
            <FieldGroup icon={<Tag size={14} />} label="Title" hint="Leave blank to use auto-derived title">
              <input
                id={`edit-title-${creative.id}`}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSaving}
                placeholder="e.g. Summer Campaign Hero Video"
                style={inputStyle}
              />
            </FieldGroup>

            {/* Date */}
            <FieldGroup icon={<Calendar size={14} />} label="Date">
              <input
                id={`edit-date-${creative.id}`}
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                disabled={isSaving}
                style={inputStyle}
              />
            </FieldGroup>

            {/* Campaign ID */}
            <FieldGroup
              icon={<Layers size={14} />}
              label="Campaign ID"
              hint="UUID of the campaign — leave blank to remove association"
            >
              <input
                id={`edit-campaign-${creative.id}`}
                type="text"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                disabled={isSaving}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12 }}
              />
            </FieldGroup>

          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid var(--color-border)",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
          {/* Error */}
          {saveError && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.2)",
              borderRadius: 8, padding: "8px 12px",
              fontSize: 12, color: "#f43f5e",
            }}>
              <AlertTriangle size={13} />
              {saveError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onClose}
              disabled={isSaving}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "transparent",
                color: "var(--color-text-secondary)",
                fontSize: 13, fontWeight: 600,
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.4 : 1,
                transition: "background 150ms",
              }}
            >
              Cancel
            </button>

            <button
              id={`edit-creative-save-${creative.id}`}
              onClick={handleSave}
              disabled={!isDirty || isSaving || saved}
              style={{
                flex: 2, padding: "10px 16px", borderRadius: 8,
                border: "none",
                background: saved
                  ? "rgba(34,211,160,0.18)"
                  : isDirty && !isSaving
                    ? "var(--color-accent)"
                    : "rgba(79,179,186,0.18)",
                color: saved
                  ? "#22d3a0"
                  : isDirty && !isSaving
                    ? "#0a1a1b"
                    : "rgba(79,179,186,0.5)",
                fontSize: 13, fontWeight: 700,
                cursor: isDirty && !isSaving && !saved ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                transition: "background 200ms, color 200ms",
                boxShadow: isDirty && !isSaving && !saved
                  ? "0 4px 14px rgba(79,179,186,0.3)"
                  : "none",
              }}
            >
              {saved
                ? <><CheckCircle2 size={14} /> Saved</>
                : isSaving
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</>
                  : <><Save size={13} /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes editPanelIn {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1;   }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FieldGroup({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 11, fontWeight: 700,
        color: "var(--color-text-secondary)",
        textTransform: "uppercase", letterSpacing: "0.07em",
        marginBottom: hint ? 4 : 8,
      }}>
        <span style={{ color: "var(--color-accent)", display: "flex" }}>{icon}</span>
        {label}
      </label>
      {hint && (
        <p style={{
          fontSize: 11, color: "var(--color-text-muted)",
          marginBottom: 8, lineHeight: 1.4,
        }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

// ── Shared input styles ───────────────────────────────────────────────────────

const baseControlStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: "9px 12px",
  color: "var(--color-text-primary)",
  fontSize: 13,
  outline: "none",
  transition: "border-color 150ms",
  appearance: "none" as const,
};

const inputStyle: React.CSSProperties = {
  ...baseControlStyle,
};

const selectStyle: React.CSSProperties = {
  ...baseControlStyle,
  cursor: "pointer",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239a9990' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 32,
};
