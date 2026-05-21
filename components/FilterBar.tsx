"use client";

/**
 * components/FilterBar.tsx
 *
 * Shared inline filter bar: free-text search + brand dropdown + ad-type pills.
 * Used on the Dashboard, Campaigns, and Creatives pages.
 *
 * Props:
 *   brands      — deduplicated list of {id, name} to populate the brand dropdown
 *   adTypes     — which ad-type pills to show (pass [] to hide entirely)
 *   value       — current filter state (controlled)
 *   onChange    — called whenever any filter changes
 *   resultCount — optional count to show in the right corner
 */

import { Search, X } from "lucide-react";
import { useRef } from "react";

export interface FilterState {
  text: string;
  brandId: string;   // "" = all
  adType: string;    // "" = all
}

export const EMPTY_FILTER: FilterState = { text: "", brandId: "", adType: "" };

export function isFiltered(f: FilterState) {
  return f.text !== "" || f.brandId !== "" || f.adType !== "";
}

interface Props {
  brands: { id: string; name: string }[];
  adTypes?: ("video" | "image" | "carousel")[];
  value: FilterState;
  onChange: (next: FilterState) => void;
  resultCount?: number;
  totalCount?: number;
  placeholder?: string;
}

const AD_TYPE_LABELS: Record<string, string> = {
  video:    "Video",
  image:    "Image",
  carousel: "Carousel",
};

export function FilterBar({
  brands,
  adTypes = ["video", "image", "carousel"],
  value,
  onChange,
  resultCount,
  totalCount,
  placeholder = "Search by title, platform, campaign…",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = isFiltered(value);

  function set(patch: Partial<FilterState>) {
    onChange({ ...value, ...patch });
  }

  function clear() {
    onChange(EMPTY_FILTER);
    inputRef.current?.focus();
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      marginBottom: 20,
      padding: "12px 16px",
      background: "var(--color-surface)",
      border: "1px solid var(--color-border)",
      borderRadius: 12,
    }}>

      {/* Text search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: "7px 12px",
        flex: "1 1 200px",
        minWidth: 160,
        transition: "border-color 150ms ease",
      }}
        onFocusCapture={(e) => e.currentTarget.style.borderColor = "var(--color-accent)"}
        onBlurCapture={(e) => e.currentTarget.style.borderColor = "var(--color-border)"}
      >
        <Search size={13} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={value.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder={placeholder}
          style={{
            flex: 1, border: "none", outline: "none",
            background: "transparent",
            color: "var(--color-text-primary)",
            fontSize: 13,
          }}
        />
        {value.text && (
          <button
            onClick={() => set({ text: "" })}
            style={{
              display: "flex", alignItems: "center",
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-text-muted)", padding: 0, flexShrink: 0,
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Brand dropdown */}
      {brands.length > 1 && (
        <select
          value={value.brandId}
          onChange={(e) => set({ brandId: e.target.value })}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: `1px solid ${value.brandId ? "var(--color-accent)" : "var(--color-border)"}`,
            background: value.brandId ? "rgba(79,179,186,0.08)" : "var(--color-surface-2)",
            color: value.brandId ? "var(--color-accent)" : "var(--color-text-secondary)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            outline: "none",
            appearance: "none",
            paddingRight: 28,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 8px center",
          }}
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}

      {/* Ad-type pills */}
      {adTypes.length > 0 && (
        <div style={{ display: "flex", gap: 4 }}>
          {adTypes.map((t) => {
            const active = value.adType === t;
            return (
              <button
                key={t}
                onClick={() => set({ adType: active ? "" : t })}
                style={{
                  padding: "6px 12px",
                  borderRadius: 7,
                  border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
                  background: active ? "rgba(79,179,186,0.12)" : "var(--color-surface-2)",
                  color: active ? "var(--color-accent)" : "var(--color-text-secondary)",
                  fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 120ms ease",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--color-accent)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = "var(--color-border)"; }}
              >
                {AD_TYPE_LABELS[t]}
              </button>
            );
          })}
        </div>
      )}

      {/* Right: result count + clear */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        {resultCount !== undefined && totalCount !== undefined && (
          <span style={{ fontSize: 12, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
            {filtered
              ? `${resultCount} of ${totalCount}`
              : `${totalCount} total`}
          </span>
        )}
        {filtered && (
          <button
            onClick={clear}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 6,
              border: "1px solid var(--color-border)",
              background: "none",
              color: "var(--color-text-muted)",
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-text-primary)"; e.currentTarget.style.borderColor = "var(--color-text-secondary)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-muted)"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
          >
            <X size={10} /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
