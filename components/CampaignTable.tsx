"use client";

/**
 * components/CampaignTable.tsx
 *
 * Client component — renders the campaigns list table with:
 * - Link to campaign dashboard
 * - Creative count badge
 * - Delete button with type-to-confirm challenge
 */

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  ExternalLink,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Film,
  Calendar,
} from "lucide-react";
import { FilterBar, FilterState, EMPTY_FILTER } from "./FilterBar";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CampaignRow {
  id: string;
  name: string;
  brand_id: string;
  brand_name: string;
  brand_logo_url: string | null;
  creative_count: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

interface DeleteModalProps {
  campaign: CampaignRow;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" }); }
  catch { return "—"; }
}

// ── Delete challenge modal ────────────────────────────────────────────────────

function DeleteModal({ campaign, onClose, onDeleted }: DeleteModalProps) {
  const [input, setInput]       = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const confirmed = input.trim() === campaign.name;

  async function handleDelete() {
    if (!confirmed || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Delete failed");
      onDeleted(campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete campaign"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: "100%", maxWidth: 460,
          background: "var(--color-surface)",
          border: "1px solid rgba(244,63,94,0.3)",
          borderRadius: 18,
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
          padding: 28,
          animation: "deleteModalIn 200ms cubic-bezier(0.22,1,0.36,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: "rgba(244,63,94,0.12)",
              border: "1px solid rgba(244,63,94,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Trash2 size={16} color="#f43f5e" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.2 }}>
                Delete Campaign
              </p>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                This action cannot be undone
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={14} color="var(--color-text-secondary)" />
          </button>
        </div>

        {/* Warning */}
        <div style={{
          background: "rgba(244,63,94,0.06)",
          border: "1px solid rgba(244,63,94,0.15)",
          borderRadius: 10, padding: "12px 14px",
          marginBottom: 20, fontSize: 13,
          color: "var(--color-text-secondary)", lineHeight: 1.5,
        }}>
          <strong style={{ color: "#f43f5e" }}>{campaign.name}</strong> will be permanently deleted.{" "}
          {campaign.creative_count > 0 ? (
            <><strong style={{ color: "var(--color-text-primary)" }}>{campaign.creative_count} creative{campaign.creative_count !== 1 ? "s" : ""}</strong> will remain in your library but will no longer be grouped under this campaign.</>
          ) : (
            "No creatives are assigned to this campaign."
          )}
        </div>

        {/* Challenge input */}
        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 8 }}>
          Type <strong style={{ color: "var(--color-text-primary)", fontFamily: "monospace" }}>{campaign.name}</strong> to confirm:
        </p>
        <input
          id="delete-campaign-confirm-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleDelete(); }}
          placeholder={campaign.name}
          autoComplete="off"
          spellCheck={false}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "10px 14px",
            borderRadius: 9,
            border: `1px solid ${confirmed ? "rgba(34,211,160,0.4)" : "var(--color-border)"}`,
            background: "var(--color-surface-2)",
            color: "var(--color-text-primary)",
            fontSize: 14, outline: "none",
            fontFamily: "monospace",
            transition: "border-color 150ms",
            marginBottom: 16,
          }}
        />

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "rgba(244,63,94,0.08)",
            border: "1px solid rgba(244,63,94,0.2)",
            borderRadius: 8, padding: "8px 12px",
            fontSize: 12, color: "#f43f5e", marginBottom: 16,
          }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            id="delete-campaign-confirm-btn"
            onClick={handleDelete}
            disabled={!confirmed || deleting}
            style={{
              flex: 1, padding: "10px 16px", borderRadius: 8,
              border: "none",
              background: confirmed && !deleting ? "#f43f5e" : "rgba(244,63,94,0.15)",
              color: confirmed && !deleting ? "#fff" : "rgba(244,63,94,0.4)",
              fontSize: 13, fontWeight: 700,
              cursor: confirmed && !deleting ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              transition: "background 150ms, color 150ms",
            }}
          >
            {deleting
              ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Deleting…</>
              : <><Trash2 size={13} /> Delete Campaign</>}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes deleteModalIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
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

// ── Main table ────────────────────────────────────────────────────────────────

interface Props {
  initialCampaigns: CampaignRow[];
}

export function CampaignTable({ initialCampaigns }: Props) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [toDelete, setToDelete]   = useState<CampaignRow | null>(null);
  const [deletedId, setDeletedId] = useState<string | null>(null);
  const [filter, setFilter]       = useState<FilterState>(EMPTY_FILTER);

  // Derive unique brands for the filter dropdown
  const brands = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of campaigns) seen.set(c.brand_id, c.brand_name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [campaigns]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = filter.text.toLowerCase();
    return campaigns.filter((c) => {
      if (filter.brandId && c.brand_id !== filter.brandId) return false;
      if (q) {
        const hay = [c.name, c.brand_name].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [campaigns, filter]);

  const handleDeleted = useCallback((id: string) => {
    setDeletedId(id);
    setTimeout(() => {
      setCampaigns(prev => prev.filter(c => c.id !== id));
      setToDelete(null);
      setDeletedId(null);
      router.refresh();
    }, 600);
  }, [router]);

  if (campaigns.length === 0) {
    return (
      <div style={{
        padding: "60px 24px", textAlign: "center",
        border: "1px dashed var(--color-border)", borderRadius: 16,
      }}>
        <Layers size={28} color="var(--color-text-muted)" style={{ margin: "0 auto 12px" }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 6 }}>
          No campaigns yet
        </p>
        <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Campaigns are created when you assign creatives to a named group.
        </p>
      </div>
    );
  }

  return (
    <>
      <FilterBar
        brands={brands}
        adTypes={[]}   /* campaigns have no ad-type */
        value={filter}
        onChange={setFilter}
        resultCount={filtered.length}
        totalCount={campaigns.length}
        placeholder="Search by campaign or brand name…"
      />

      {/* Table */}
      <div style={{
        border: "1px solid var(--color-border)",
        borderRadius: 14, overflow: "hidden",
      }}>
        {/* Header row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 160px 100px 80px 100px",
          padding: "10px 20px",
          background: "var(--color-surface-2)",
          borderBottom: "1px solid var(--color-border)",
          fontSize: 11, fontWeight: 600,
          color: "var(--color-text-muted)",
          textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          <span>Campaign</span>
          <span>Brand</span>
          <span style={{ textAlign: "center" }}>Creatives</span>
          <span>Dates</span>
          <span></span>
        </div>

        {/* Rows */}
        {filtered.map((c, i) => {
          const isDeleting = deletedId === c.id;
          return (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 160px 100px 80px 100px",
                padding: "14px 20px",
                alignItems: "center",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--color-border)" : "none",
                background: isDeleting ? "rgba(244,63,94,0.04)" : "transparent",
                opacity: isDeleting ? 0.5 : 1,
                transition: "opacity 400ms, background 400ms",
              }}
            >
              {/* Campaign name + link */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: "rgba(79,179,186,0.1)",
                  border: "1px solid rgba(79,179,186,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Layers size={14} color="var(--color-accent)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Link
                    href={`/campaigns/${c.id}`}
                    style={{
                      fontSize: 14, fontWeight: 600,
                      color: "var(--color-text-primary)",
                      textDecoration: "none",
                      display: "flex", alignItems: "center", gap: 5,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}
                    title={c.name}
                  >
                    {c.name}
                    <ExternalLink size={11} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                  </Link>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2, fontFamily: "monospace" }}>
                    {c.id.slice(0, 8)}…
                  </p>
                </div>
              </div>

              {/* Brand */}
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                {c.brand_logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.brand_logo_url}
                    alt={c.brand_name}
                    style={{ width: 18, height: 18, borderRadius: 4, objectFit: "contain", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: "var(--color-accent)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 9, fontWeight: 800, color: "#0a1a1b",
                  }}>
                    {c.brand_name[0]?.toUpperCase()}
                  </div>
                )}
                <span style={{
                  fontSize: 13, color: "var(--color-text-secondary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {c.brand_name}
                </span>
              </div>

              {/* Creative count */}
              <div style={{ textAlign: "center" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 12, fontWeight: 600,
                  color: c.creative_count > 0 ? "var(--color-accent)" : "var(--color-text-muted)",
                  background: c.creative_count > 0 ? "rgba(79,179,186,0.1)" : "transparent",
                  borderRadius: 6, padding: "3px 8px",
                }}>
                  <Film size={11} />
                  {c.creative_count}
                </span>
              </div>

              {/* Dates */}
              <div>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                  {c.start_date ? (
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Calendar size={10} />
                      {fmtDate(c.start_date)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>No date</span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                {isDeleting ? (
                  <CheckCircle2 size={16} color="#22d3a0" />
                ) : (
                  <button
                    id={`delete-campaign-${c.id}`}
                    title="Delete campaign"
                    onClick={() => setToDelete(c)}
                    style={{
                      width: 30, height: 30, borderRadius: 7,
                      background: "transparent",
                      border: "1px solid var(--color-border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                      color: "var(--color-text-muted)",
                      transition: "all 150ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(244,63,94,0.1)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(244,63,94,0.3)";
                      (e.currentTarget as HTMLButtonElement).style.color = "#f43f5e";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--color-text-muted)";
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete challenge modal */}
      {toDelete && (
        <DeleteModal
          campaign={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={handleDeleted}
        />
      )}
    </>
  );
}
