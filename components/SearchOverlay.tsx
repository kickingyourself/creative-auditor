"use client";

/**
 * components/SearchOverlay.tsx
 *
 * Full-screen command-palette search overlay.
 * - Triggered by clicking the header search bar or pressing ⌘K / Ctrl+K
 * - Debounced fetch to /api/search?q=<query>
 * - Grouped results: Brands · Campaigns · Creatives · Comparisons
 * - Keyboard navigation (↑↓ Enter Escape)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search, X, ArrowRight, Loader2,
  Layers, PlayCircle, Share2, Globe, BarChart2, Building2,
} from "lucide-react";
import type { SearchResult } from "@/app/api/search/route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<SearchResult["type"], {
  label: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
}> = {
  brand:    { label: "Brand",      Icon: Building2,  color: "#22d3a0", bg: "rgba(34,211,160,0.12)"  },
  campaign: { label: "Campaign",   Icon: Layers,      color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  creative: { label: "Creative",   Icon: PlayCircle,  color: "#ff8800", bg: "rgba(255,136,0,0.12)"   },
  snapshot: { label: "Comparison", Icon: BarChart2,   color: "#38bdf8", bg: "rgba(56,189,248,0.12)"  },
};

const PLATFORM_COLORS: Record<string, string> = {
  youtube:      "#ff4444",
  tiktok:       "#69c9d0",
  landing_page: "#22d3a0",
  homepage:     "#22d3a0",
  pinterest:    "#e60023",
  meta:         "#1877f2",
  social:       "#a78bfa",
  programmatic: "#f59e0b",
  ooh:          "#06b6d4",
  tvc:          "#8b5cf6",
  website:      "#fb923c",
};

function platformColor(p: string) {
  return PLATFORM_COLORS[p] ?? "#9a9990";
}

function groupResults(results: SearchResult[]) {
  const order: SearchResult["type"][] = ["brand", "campaign", "creative", "snapshot"];
  const groups: Record<string, SearchResult[]> = {};
  for (const r of results) {
    (groups[r.type] ??= []).push(r);
  }
  return order.filter((t) => groups[t]?.length).map((t) => ({ type: t, items: groups[t] }));
}

// ── Result Row ────────────────────────────────────────────────────────────────

function ResultRow({
  result,
  active,
  onHover,
  onClick,
  highlight,
}: {
  result: SearchResult;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
  highlight: string;
}) {
  const cfg = TYPE_CONFIG[result.type];
  const Icon = cfg.Icon;

  // Bold-highlight matching text
  function hl(text: string) {
    if (!highlight) return text;
    const idx = text.toLowerCase().indexOf(highlight.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark style={{ background: "rgba(34,211,160,0.25)", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
          {text.slice(idx, idx + highlight.length)}
        </mark>
        {text.slice(idx + highlight.length)}
      </>
    );
  }

  return (
    <div
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 16px",
        borderRadius: 10,
        cursor: "pointer",
        background: active ? "var(--color-surface-2)" : "transparent",
        transition: "background 100ms ease",
        margin: "1px 0",
      }}
    >
      {/* Thumbnail or icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 8, flexShrink: 0, overflow: "hidden",
        background: cfg.bg, border: `1px solid ${cfg.color}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {result.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={result.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Icon size={16} color={cfg.color} />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}>
          {hl(result.title)}
        </p>
        <p style={{
          fontSize: 11, color: "var(--color-text-muted)", marginTop: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {result.subtitle}
        </p>
      </div>

      {/* Badge */}
      {result.meta && (
        <span style={{
          fontSize: 10, fontWeight: 600, flexShrink: 0,
          color: result.type === "creative" ? platformColor(result.meta) : cfg.color,
          background: result.type === "creative"
            ? `${platformColor(result.meta)}18`
            : cfg.bg,
          borderRadius: 4, padding: "2px 7px",
          textTransform: "capitalize",
        }}>
          {result.meta.replace(/_/g, " ")}
        </span>
      )}

      {/* Arrow hint when active */}
      {active && <ArrowRight size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />}
    </div>
  );
}

// ── Main overlay ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function SearchOverlay({ open, onClose, initialQuery = "" }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setResults([]);
      setActiveIdx(0);
    }
  }, [open, initialQuery]);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    clearTimeout(debounceRef.current);
    if (!q || q.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(json.results ?? []);
        setActiveIdx(0);
      } catch { /* swallow */ }
      finally { setLoading(false); }
    }, 200);
  }, []);

  useEffect(() => { doSearch(query); }, [query, doSearch]);

  // Navigate to result
  const navigate = useCallback((result: SearchResult) => {
    onClose();
    router.push(result.href);
  }, [onClose, router]);

  // Keyboard handler
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter")     { navigate(results[activeIdx]); }
  }, [results, activeIdx, navigate, onClose]);

  const groups = groupResults(results);

  // Build flat index mapping result → global idx
  const flat = groups.flatMap((g) => g.items);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(10px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "80px 24px 60px",
        animation: "searchBgIn 150ms ease both",
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 620,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          animation: "searchPanelIn 180ms cubic-bezier(0.34,1.56,0.64,1) both",
          display: "flex", flexDirection: "column",
          maxHeight: "calc(100vh - 160px)",
        }}
      >
        {/* Input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px",
          borderBottom: results.length > 0 || loading ? "1px solid var(--color-border)" : "none",
          flexShrink: 0,
        }}>
          {loading
            ? <Loader2 size={18} color="var(--color-accent)" style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }} />
            : <Search size={18} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
          }
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search creatives, campaigns, brands…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              color: "var(--color-text-primary)", fontSize: 16, fontWeight: 500,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: 5,
                  background: "var(--color-surface-2)", border: "none", cursor: "pointer",
                  color: "var(--color-text-muted)",
                }}
              >
                <X size={12} />
              </button>
            )}
            <kbd style={{
              fontSize: 11, color: "var(--color-text-muted)",
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 5, padding: "2px 7px", fontFamily: "monospace",
            }}>
              esc
            </kbd>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div role="listbox" style={{ overflowY: "auto", padding: "8px 8px" }}>
            {groups.map(({ type, items }) => {
              const cfg = TYPE_CONFIG[type];
              const Icon = cfg.Icon;
              return (
                <div key={type}>
                  {/* Group header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 8px 4px",
                    fontSize: 10, fontWeight: 700,
                    color: "var(--color-text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                  }}>
                    <Icon size={10} />
                    {cfg.label}s
                  </div>
                  {items.map((result) => {
                    const globalIdx = flat.indexOf(result);
                    return (
                      <ResultRow
                        key={result.id}
                        result={result}
                        active={globalIdx === activeIdx}
                        onHover={() => setActiveIdx(globalIdx)}
                        onClick={() => navigate(result)}
                        highlight={query}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div style={{
            padding: "40px 24px", textAlign: "center",
            color: "var(--color-text-muted)", fontSize: 14,
          }}>
            <Search size={28} style={{ opacity: 0.3, marginBottom: 10 }} />
            <p style={{ fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 4 }}>No results for &ldquo;{query}&rdquo;</p>
            <p style={{ fontSize: 12 }}>Try a different keyword — brand name, platform, campaign, or title.</p>
          </div>
        )}

        {/* Tip when idle */}
        {query.length < 2 && !loading && (
          <div style={{
            padding: "20px 24px",
            display: "flex", flexWrap: "wrap", gap: 8,
          }}>
            {(["YouTube", "Pinterest", "Landing Page", "Programmatic"] as const).map((tip) => (
              <button
                key={tip}
                onClick={() => setQuery(tip)}
                style={{
                  padding: "5px 12px", borderRadius: 6, cursor: "pointer",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-2)",
                  color: "var(--color-text-secondary)",
                  fontSize: 12, fontWeight: 500,
                  transition: "all 120ms ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; e.currentTarget.style.color = "var(--color-accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-text-secondary)"; }}
              >
                {tip}
              </button>
            ))}
            <div style={{ width: "100%", fontSize: 11, color: "var(--color-text-muted)", marginTop: 4 }}>
              Search across creatives, campaigns, brands, and competitive reports
            </div>
          </div>
        )}

        {/* Keyboard hints */}
        {results.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
            padding: "8px 16px", borderTop: "1px solid var(--color-border)",
            fontSize: 10, color: "var(--color-text-muted)",
          }}>
            {[
              ["↑↓", "navigate"],
              ["↵", "open"],
              ["esc", "close"],
            ].map(([key, label]) => (
              <span key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <kbd style={{
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 4, padding: "1px 5px",
                  fontFamily: "monospace", fontSize: 10,
                }}>
                  {key}
                </kbd>
                {label}
              </span>
            ))}
            <span style={{ marginLeft: "auto" }}>{results.length} result{results.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes searchBgIn   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes searchPanelIn { from { opacity: 0; transform: scale(0.96) translateY(-12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>,
    document.body
  );
}
