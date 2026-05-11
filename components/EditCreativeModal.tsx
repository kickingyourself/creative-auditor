"use client";

/**
 * components/EditCreativeModal.tsx
 *
 * Slide-in sheet for editing a creative's metadata:
 *   • Brand      — select from all brands
 *   • Title      — free text; blank = derived from URL
 *   • Date       — the creative's created_at timestamp
 *   • Campaign   — searchable autocomplete by name (stores UUID internally)
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useId,
} from "react";
import { createPortal } from "react-dom";
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
  Search,
  XCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandOption {
  id: string;
  name: string;
  logo_url: string | null;
}

interface CampaignOption {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
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
  onSave: (id: string, patch: EditCreativePayload & { brand_name?: string; campaign_name?: string }) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toISOString().slice(0, 10); }
  catch { return ""; }
}

function dateInputToIso(value: string): string {
  if (!value) return new Date().toISOString();
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

// ── Campaign combobox ─────────────────────────────────────────────────────────

interface CampaignComboboxProps {
  brandId: string;
  /** Currently selected campaign UUID (or null = none) */
  value: string | null;
  onChange: (id: string | null, name: string) => void;
  /** Called on every keystroke so the parent can track that the field was touched. */
  onQueryChange?: (query: string) => void;
  disabled?: boolean;
  /** The campaign name to display on load (so we can pre-fill the input) */
  initialName?: string;
  creativeId: string;
}

function CampaignCombobox({
  brandId,
  value,
  onChange,
  onQueryChange,
  disabled,
  initialName,
  creativeId,
}: CampaignComboboxProps) {
  const inputId = useId();

  // The text the user is typing
  const [query, setQuery]           = useState(initialName ?? "");
  // All campaigns for the current brand
  const [campaigns, setCampaigns]   = useState<CampaignOption[]>([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const firstRender  = useRef(true);

  // Filter by query
  const filtered = query.trim()
    ? campaigns.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : campaigns;

  // ── Fetch campaigns when brand changes ──────────────────────────────────
  useEffect(() => {
    if (!brandId) return;
    let active = true;
    setLoading(true);

    // On brand change (not first render) reset the selection
    if (!firstRender.current) {
      setQuery("");
      onChange(null, "");
    }
    firstRender.current = false;

    fetch(`/api/campaigns?brand_id=${encodeURIComponent(brandId)}`)
      .then((r) => r.json())
      .then((data) => { if (active) setCampaigns(data.campaigns ?? []); })
      .catch(() => { if (active) setCampaigns([]); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  // On first mount, restore the current campaign's name if we have an ID
  useEffect(() => {
    if (value && initialName) {
      setQuery(initialName);
    }
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Click outside to close ──────────────────────────────────────────────
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If user typed something that doesn't match a selected campaign, revert
        if (value) {
          const selected = campaigns.find((c) => c.id === value);
          setQuery(selected?.name ?? "");
        }
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [value, campaigns]);

  function handleSelect(campaign: CampaignOption) {
    onChange(campaign.id, campaign.name);
    setQuery(campaign.name);
    setOpen(false);
  }

  function handleClear() {
    onChange(null, "");
    setQuery("");
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    onQueryChange?.(v);          // notify parent on every keystroke
    if (!v.trim()) onChange(null, "");  // clear selection when field is emptied
  }

  const isSelected = value !== null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Input with search icon */}
      <div style={{ position: "relative" }}>
        <Search
          size={13}
          style={{
            position: "absolute", left: 10, top: "50%",
            transform: "translateY(-50%)",
            color: "var(--color-text-muted)",
            pointerEvents: "none",
          }}
        />
        <input
          ref={inputRef}
          id={`edit-campaign-${creativeId}-${inputId}`}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={`campaign-listbox-${creativeId}`}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
            if (e.key === "ArrowDown" && filtered.length > 0) {
              setOpen(true);
              // focus first option
              const list = document.getElementById(`campaign-listbox-${creativeId}`);
              (list?.firstElementChild as HTMLElement)?.focus();
            }
          }}
          disabled={disabled || loading}
          placeholder={
            loading
              ? "Loading campaigns…"
              : campaigns.length === 0
                ? "No campaigns for this brand"
                : "Search campaigns…"
          }
          autoComplete="off"
          style={{
            ...baseControlStyle,
            paddingLeft: 30,
            paddingRight: isSelected ? 30 : 12,
            cursor: "text",
            borderColor: open ? "var(--color-accent)" : undefined,
          }}
        />
        {/* Clear button */}
        {isSelected && !disabled && (
          <button
            onClick={handleClear}
            tabIndex={-1}
            title="Remove campaign"
            style={{
              position: "absolute", right: 8, top: "50%",
              transform: "translateY(-50%)",
              background: "none", border: "none",
              padding: 2, cursor: "pointer",
              color: "var(--color-text-muted)",
              display: "flex", alignItems: "center",
            }}
          >
            <XCircle size={13} />
          </button>
        )}
      </div>

      {/* Dropdown list */}
      {open && filtered.length > 0 && (
        <ul
          id={`campaign-listbox-${creativeId}`}
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            zIndex: 10000,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 10,
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            maxHeight: 220,
            overflowY: "auto",
            listStyle: "none",
            padding: "4px",
            margin: 0,
          }}
        >
          {filtered.map((c) => {
            const isActive = c.id === value;
            return (
              <li
                key={c.id}
                role="option"
                aria-selected={isActive}
                tabIndex={0}
                onPointerDown={(e) => { e.preventDefault(); handleSelect(c); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelect(c); }
                  if (e.key === "Escape") { setOpen(false); inputRef.current?.focus(); }
                  if (e.key === "ArrowDown") {
                    (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
                  }
                  if (e.key === "ArrowUp") {
                    const prev = e.currentTarget.previousElementSibling as HTMLElement;
                    if (prev) prev.focus(); else inputRef.current?.focus();
                  }
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 7,
                  cursor: "pointer",
                  background: isActive ? "rgba(79,179,186,0.12)" : "transparent",
                  color: isActive ? "var(--color-accent)" : "var(--color-text-primary)",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  outline: "none",
                  transition: "background 120ms",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{c.name}</span>
                {(c.start_date || c.end_date) && (
                  <span style={{ fontSize: 11, color: "var(--color-text-muted)", flexShrink: 0, marginLeft: 8 }}>
                    {c.start_date?.slice(0, 7) ?? "?"} – {c.end_date?.slice(0, 7) ?? "ongoing"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* No results hint */}
      {open && query.trim() && filtered.length === 0 && !loading && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          zIndex: 10000,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 10,
          padding: "12px 14px",
          fontSize: 12,
          color: "var(--color-text-muted)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        }}>
          No campaigns match &ldquo;{query}&rdquo;
        </div>
      )}

      {/* Selected campaign badge */}
      {value && (
        <p style={{
          fontSize: 11, color: "var(--color-accent)",
          marginTop: 5,
          fontFamily: "monospace",
          opacity: 0.7,
        }}>
          ID: {value}
        </p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function EditCreativeModal({ creative, onClose, onSave }: Props) {
  // Form fields
  const [brandId,      setBrandId]      = useState(creative.brand_id);
  const [title,        setTitle]        = useState(creative.title ?? "");
  const [dateValue,    setDateValue]    = useState(isoToDateInput(creative.created_at));
  const [campaignId,   setCampaignId]   = useState<string | null>(creative.campaign_id ?? null);
  const [campaignName, setCampaignName] = useState("");
  const [campaignTouched, setCampaignTouched] = useState(false);

  // Brands list for the select
  const [brands,        setBrands]        = useState<BrandOption[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);

  // Submission state
  const [isSaving,  setIsSaving]  = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  // ── Fetch brand list on mount ───────────────────────────────────────────
  useEffect(() => {
    let active = true;
    fetch("/api/brands")
      .then((r) => r.json())
      .then((data) => { if (active) setBrands(data.brands ?? []); })
      .catch(() => { /* silent */ })
      .finally(() => { if (active) setBrandsLoading(false); });
    return () => { active = false; };
  }, []);

  // ── Close on Escape ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSaving) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSaving, onClose]);

  // ── Click-outside to close ──────────────────────────────────────────────
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !isSaving) onClose();
  }, [isSaving, onClose]);

  // ── Handle brand change ─────────────────────────────────────────────────
  function handleBrandChange(newBrandId: string) {
    setBrandId(newBrandId);
    // Campaign combobox will reset itself when brandId prop changes
  }

  // ── Handle campaign selection from combobox ─────────────────────────────
  function handleCampaignChange(id: string | null, name: string) {
    setCampaignId(id);
    setCampaignName(name);
    setCampaignTouched(true);
  }


  // ── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);

    const payload: EditCreativePayload = {
      brand_id:    brandId,
      title:       title.trim() || null,
      created_at:  dateInputToIso(dateValue),
      campaign_id: campaignId,
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

      const selectedBrand = brands.find((b) => b.id === brandId);
      setSaved(true);
      onSave(creative.id, {
        ...payload,
        brand_name:    selectedBrand?.name,
        campaign_name: campaignName || undefined,
      });

      setTimeout(onClose, 900);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error.");
      setIsSaving(false);
    }
  }

  const isDirty =
    brandId    !== creative.brand_id                     ||
    (title.trim() || null) !== (creative.title ?? null) ||
    dateValue  !== isoToDateInput(creative.created_at)  ||
    campaignId !== (creative.campaign_id ?? null)        ||
    campaignTouched;

  // ── Lock body scroll while open ──────────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────
  const modal = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="Edit creative"
      onClick={handleOverlayClick}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* Dialog box */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 740,
          background: "var(--color-surface)",
          borderRadius: 18,
          border: "1px solid var(--color-border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          animation: "editModalIn 220ms cubic-bezier(0.22,1,0.36,1) both",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: "1px solid var(--color-border)",
        }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.2 }}>
              Edit Creative
            </p>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 3 }}>
              {creative.title}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            id={`edit-creative-close-${creative.id}`}
            aria-label="Close"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 8,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.4 : 1,
            }}
          >
            <X size={15} color="var(--color-text-secondary)" />
          </button>
        </div>

        {/* ── Body: thumbnail + form side-by-side ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: creative.thumbnail_url ? "220px 1fr" : "1fr",
        }}>
          {/* Thumbnail */}
          {creative.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creative.thumbnail_url}
              alt=""
              style={{
                width: "100%",
                aspectRatio: "4 / 3",
                objectFit: "cover",
                borderRight: "1px solid var(--color-border)",
                display: "block",
                alignSelf: "stretch",
              }}
            />
          )}

          {/* Form */}
          <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Brand */}
            <FieldGroup icon={<Layers size={14} />} label="Brand">
              <select
                id={`edit-brand-${creative.id}`}
                value={brandId}
                onChange={(e) => handleBrandChange(e.target.value)}
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

            {/* Campaign */}
            <FieldGroup
              icon={<Layers size={14} />}
              label="Campaign"
              hint="Search by name — leave empty to remove association"
            >
              <CampaignCombobox
                brandId={brandId}
                value={campaignId}
                onChange={handleCampaignChange}
                onQueryChange={() => setCampaignTouched(true)}
                disabled={isSaving}
                initialName={campaignName}
                creativeId={creative.id}
              />
            </FieldGroup>

          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}>
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
        @keyframes editModalIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // Render into document.body so no ancestor overflow:hidden can clip it
  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
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
