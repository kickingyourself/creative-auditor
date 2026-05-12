"use client";

/**
 * components/CampaignPicker.tsx
 *
 * Shared searchable campaign combobox used by all ingest forms.
 *
 * - Fetches campaigns for the given brandId via GET /api/campaigns?brand_id=...
 * - Type-to-search filters the list
 * - If no match is found, offers "Create campaign <name>" which POSTs
 *   to /api/campaigns and immediately selects the new campaign
 * - Calls onChange({ id, name }) when a campaign is selected or created
 * - Calls onChange(null) when cleared
 */

import { useState, useEffect, useRef } from "react";
import {
  Search,
  XCircle,
  PlusCircle,
  Loader2,
  Layers,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CampaignOption {
  id: string;
  name: string;
}

interface Props {
  /** UUID of the owning brand — used to scope the campaign list */
  brandId: string;
  /** Unique suffix for element IDs (e.g. "scrape-form" + brandId) */
  instanceId: string;
  /** Whether the picker is disabled (e.g. while the parent is submitting) */
  disabled?: boolean;
  /** Called when the user selects / creates a campaign, or clears the field */
  onChange: (campaign: CampaignOption | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CampaignPicker({ brandId, instanceId, disabled, onChange }: Props) {
  const [query,     setQuery]     = useState("");
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [creating,  setCreating]  = useState(false);
  const [open,      setOpen]      = useState(false);
  const [selected,  setSelected]  = useState<CampaignOption | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  const inputId   = `campaign-picker-input-${instanceId}`;
  const listboxId = `campaign-picker-list-${instanceId}`;

  // ── Fetch campaigns whenever brandId changes ──────────────────────────────
  useEffect(() => {
    if (!brandId) return;
    let active = true;
    setLoading(true);
    setCampaigns([]);
    setQuery("");
    setSelected(null);
    onChange(null);

    fetch(`/api/campaigns?brand_id=${encodeURIComponent(brandId)}`)
      .then((r) => r.json())
      .then((d) => { if (active) setCampaigns(d.campaigns ?? []); })
      .catch(() => { if (active) setCampaigns([]); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  // ── Click outside to close ───────────────────────────────────────────────
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If nothing selected, revert query to empty
        if (!selected) setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selected]);

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = query.trim()
    ? campaigns.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : campaigns;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSelect(c: CampaignOption) {
    setSelected(c);
    setQuery(c.name);
    setOpen(false);
    onChange(c);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    onChange(null);
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (!v.trim()) {
      setSelected(null);
      onChange(null);
    }
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name || !brandId || creating) return;
    setCreating(true);
    try {
      const res  = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId, name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create campaign");
      const created: CampaignOption = { id: json.campaign.id, name: json.campaign.name };
      setCampaigns((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      handleSelect(created);
    } catch (err) {
      console.error("Campaign create failed:", err);
    } finally {
      setCreating(false);
    }
  }

  const showCreate = open && query.trim() && filtered.length === 0 && !loading;
  const isSelected = selected !== null;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Input */}
      <div style={{ position: "relative" }}>
        <Layers
          size={13}
          style={{
            position: "absolute", left: 10, top: "50%",
            transform: "translateY(-50%)",
            color: isSelected ? "var(--color-accent)" : "var(--color-text-muted)",
            pointerEvents: "none",
          }}
        />
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          value={query}
          onChange={handleInputChange}
          onFocus={() => { if (!selected) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
            if (e.key === "ArrowDown" && filtered.length > 0) {
              setOpen(true);
              (document.getElementById(listboxId)?.firstElementChild as HTMLElement)?.focus();
            }
          }}
          disabled={disabled || loading}
          placeholder={
            loading
              ? "Loading campaigns…"
              : campaigns.length === 0
                ? "Type to create a campaign"
                : "Search or create a campaign"
          }
          autoComplete="off"
          style={{
            width: "100%",
            boxSizing: "border-box",
            background: "var(--color-surface-2)",
            border: `1px solid ${open ? "var(--color-accent)" : "var(--color-border)"}`,
            borderRadius: "8px",
            padding: `10px 12px 10px ${isSelected ? "30px" : "30px"}`,
            paddingRight: isSelected ? "30px" : "12px",
            color: "var(--color-text-primary)",
            fontSize: "13px",
            outline: "none",
            opacity: (disabled || loading) ? 0.5 : 1,
            transition: "border-color 150ms",
          }}
        />
        {/* Clear × */}
        {isSelected && !disabled && (
          <button
            onClick={handleClear}
            tabIndex={-1}
            title="Clear campaign"
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

      {/* Dropdown: matching results */}
      {open && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            zIndex: 10000,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "10px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            maxHeight: 200,
            overflowY: "auto",
            listStyle: "none",
            padding: "4px",
            margin: 0,
          }}
        >
          {filtered.map((c) => {
            const isActive = c.id === selected?.id;
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
                  if (e.key === "ArrowDown") (e.currentTarget.nextElementSibling as HTMLElement)?.focus();
                  if (e.key === "ArrowUp") {
                    const prev = e.currentTarget.previousElementSibling as HTMLElement;
                    if (prev) prev.focus(); else inputRef.current?.focus();
                  }
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: "7px",
                  cursor: "pointer",
                  fontSize: "13px",
                  background: isActive ? "rgba(79,179,186,0.12)" : "transparent",
                  color: isActive ? "var(--color-accent)" : "var(--color-text-primary)",
                  fontWeight: isActive ? 600 : 400,
                  outline: "none",
                  transition: "background 100ms",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {c.name}
              </li>
            );
          })}
        </ul>
      )}

      {/* Dropdown: create new */}
      {showCreate && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          zIndex: 10000,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "10px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", gap: "8px",
              padding: "11px 14px",
              background: "none", border: "none",
              cursor: creating ? "not-allowed" : "pointer",
              textAlign: "left",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
          >
            {creating
              ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)", flexShrink: 0 }} />
              : <PlusCircle size={13} style={{ color: "var(--color-accent)", flexShrink: 0 }} />}
            <span style={{ fontSize: "13px", color: "var(--color-text-primary)" }}>
              {creating
                ? "Creating…"
                : <><span style={{ color: "var(--color-text-muted)" }}>Create campaign</span> &ldquo;<strong>{query.trim()}</strong>&rdquo;</>}
            </span>
          </button>
        </div>
      )}

      {/* Selected badge */}
      {isSelected && (
        <p style={{
          fontSize: "11px",
          color: "var(--color-accent)",
          marginTop: "5px",
          opacity: 0.7,
        }}>
          ✓ {selected!.name}
        </p>
      )}

      {/* Search hint when empty */}
      {!isSelected && !open && !loading && (
        <p style={{
          fontSize: "11px",
          color: "var(--color-text-muted)",
          marginTop: "5px",
          display: "flex", alignItems: "center", gap: "4px",
        }}>
          <Search size={10} style={{ flexShrink: 0 }} />
          Type to search existing campaigns or create a new one
        </p>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
