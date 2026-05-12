"use client";

/**
 * components/BrandCard.tsx
 *
 * Client component for a single brand card.
 * Includes a hover-reveal delete button with a name-confirmation modal —
 * the user must type the exact brand name to confirm (since this cascades
 * to all associated creatives).
 */

import { useState, useCallback } from "react";
import {
  Building2, Globe, TrendingUp,
  Trash2, AlertTriangle, Loader2,
} from "lucide-react";
import { BrandIngestPanel } from "@/components/BrandIngestPanel";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BrandWithCount {
  id: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  created_at: string;
  creative_count: number;
}

interface BrandCardProps {
  brand: BrandWithCount;
  index: number;
  onDelete?: (id: string) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PALETTE = [
  { color: "#ff4444", bg: "rgba(255,68,68,0.12)" },
  { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  { color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
  { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  { color: "#22d3a0", bg: "rgba(34,211,160,0.12)" },
  { color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  { color: "#e879f9", bg: "rgba(232,121,249,0.12)" },
  { color: "#4fb3ba", bg: "rgba(79,179,186,0.12)" },
];

function brandColor(name: string) {
  const idx = name.charCodeAt(0) % PALETTE.length;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  return { ...PALETTE[idx], initials };
}

// ── Component ────────────────────────────────────────────────────────────────

export function BrandCard({ brand, index, onDelete }: BrandCardProps) {
  const { color, bg, initials } = brandColor(brand.name);

  // Hover + delete modal state
  const [hovered, setHovered]         = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Must type the exact brand name to confirm (case-insensitive)
  const confirmed = confirmText.trim().toLowerCase() === brand.name.trim().toLowerCase();

  const openModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmText(""); setDeleteError(null); setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    if (isDeleting) return;
    setShowModal(false); setConfirmText(""); setDeleteError(null);
  }, [isDeleting]);

  async function handleDelete() {
    if (!confirmed || isDeleting) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res  = await fetch(`/api/brands/${brand.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError(json?.detail ?? json?.error ?? "Delete failed.");
        setIsDeleting(false);
        return;
      }
      setShowModal(false);
      onDelete?.(brand.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Network error.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <section
        id={`brand-card-${brand.id}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", flexDirection: "column",
          border: "1px solid var(--color-border)",
          borderRadius: "16px", overflow: "hidden",
          animation: "fadeInUp 0.5s ease both",
          animationDelay: `${index * 80}ms`,
          transition: "border-color 200ms",
        }}
      >
        {/* Brand header */}
        <div style={{
          background: "var(--color-surface)", padding: "20px",
          display: "flex", alignItems: "center", gap: "14px",
          borderBottom: "1px solid var(--color-border)",
          position: "relative",
        }}>
          {/* Logo / initials avatar */}
          {brand.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logo_url}
              alt={brand.name}
              style={{
                width: 28, height: 28, borderRadius: "6px",
                objectFit: "contain", flexShrink: 0, imageRendering: "auto",
              }}
            />
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: "6px",
              background: bg, border: `1px solid ${color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 800, color, flexShrink: 0,
              letterSpacing: "-0.02em",
            }}>
              {initials}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              fontSize: "15px", fontWeight: 700,
              color: "var(--color-text-primary)", letterSpacing: "-0.02em",
            }}>
              {brand.name}
            </h2>
            {brand.website_url && (
              <a
                href={brand.website_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  fontSize: "12px", color: "var(--color-text-muted)",
                  textDecoration: "none", marginTop: "2px",
                }}
              >
                <Globe size={11} />
                {brand.website_url.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>

          {/* Right-side: stats + delete button */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Delete button — reveals on hover */}
            <button
              onClick={openModal}
              title="Delete brand"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 30, height: 30,
                background: "rgba(244,63,94,0.85)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(244,63,94,0.4)",
                borderRadius: "8px",
                cursor: "pointer",
                opacity: hovered ? 1 : 0,
                transform: hovered ? "scale(1)" : "scale(0.8)",
                transition: "opacity 180ms ease, transform 180ms ease",
                pointerEvents: hovered ? "auto" : "none",
                flexShrink: 0,
              }}
            >
              <Trash2 size={13} color="#fff" />
            </button>

            {/* Stats chips */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "5px",
                fontSize: "12px", fontWeight: 700,
                color: "var(--color-text-primary)",
              }}>
                <Building2 size={11} color="var(--color-text-muted)" />
                {brand.creative_count.toLocaleString()} creative{brand.creative_count !== 1 ? "s" : ""}
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: "5px",
                fontSize: "11px", color: "var(--color-text-muted)",
              }}>
                <TrendingUp size={10} />
                Added {new Date(brand.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
          </div>
        </div>

        {/* Ingest panel */}
        <div style={{ background: "var(--color-bg)", padding: "16px" }}>
          <BrandIngestPanel brandId={brand.id} brandName={brand.name} />
        </div>
      </section>

      {/* ── Delete confirmation modal ──────────────────────────────────────── */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--color-surface)",
              border: "1px solid rgba(244,63,94,0.25)",
              borderRadius: 16, padding: 28,
              maxWidth: 460, width: "100%",
              display: "flex", flexDirection: "column", gap: 20,
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              animation: "brandModalIn 200ms cubic-bezier(0.34,1.56,0.64,1) both",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                background: "rgba(244,63,94,0.12)",
                border: "1px solid rgba(244,63,94,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <AlertTriangle size={20} color="#f43f5e" />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
                  Delete &ldquo;{brand.name}&rdquo;?
                </p>
                <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 5, lineHeight: 1.6 }}>
                  This permanently removes the brand and all{" "}
                  <strong style={{ color: "var(--color-text-primary)" }}>
                    {brand.creative_count} creative{brand.creative_count !== 1 ? "s" : ""}
                  </strong>{" "}
                  from the database and storage.
                  <strong style={{ color: "#f43f5e" }}> This cannot be undone.</strong>
                </p>
              </div>
            </div>

            {/* Brand preview chip */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
              borderRadius: 10, padding: "10px 14px",
            }}>
              {brand.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logo_url} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "contain" }} />
              ) : (
                <div style={{
                  width: 22, height: 22, borderRadius: 4,
                  background: bg, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "9px", fontWeight: 800, color,
                }}>
                  {initials}
                </div>
              )}
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                {brand.name}
              </span>
              <span style={{
                marginLeft: "auto", fontSize: 11, fontWeight: 600,
                color: "#f43f5e", background: "rgba(244,63,94,0.1)",
                padding: "2px 8px", borderRadius: 4,
              }}>
                {brand.creative_count} creative{brand.creative_count !== 1 ? "s" : ""} will be deleted
              </span>
            </div>

            {/* Confirmation input */}
            <div>
              <label
                htmlFor={`brand-delete-confirm-${brand.id}`}
                style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8 }}
              >
                Type{" "}
                <code style={{
                  background: "rgba(244,63,94,0.12)", color: "#f43f5e",
                  padding: "1px 6px", borderRadius: 4, fontFamily: "monospace",
                }}>
                  {brand.name}
                </code>{" "}
                to confirm
              </label>
              <input
                id={`brand-delete-confirm-${brand.id}`}
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && confirmed) handleDelete();
                  if (e.key === "Escape") closeModal();
                }}
                placeholder={brand.name}
                autoFocus
                autoComplete="off"
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--color-surface-2)",
                  border: `1px solid ${confirmed ? "rgba(244,63,94,0.6)" : "var(--color-border)"}`,
                  borderRadius: 8, padding: "10px 12px",
                  color: confirmed ? "#f43f5e" : "var(--color-text-primary)",
                  fontSize: 13, outline: "none",
                  transition: "border-color 200ms, color 200ms",
                }}
              />
            </div>

            {/* Error */}
            {deleteError && (
              <p style={{
                fontSize: 12, color: "#f43f5e",
                background: "rgba(244,63,94,0.08)",
                padding: "8px 12px", borderRadius: 6,
              }}>
                {deleteError}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={closeModal}
                disabled={isDeleting}
                style={{
                  padding: "9px 18px", borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "none", color: "var(--color-text-secondary)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  opacity: isDeleting ? 0.4 : 1,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!confirmed || isDeleting}
                style={{
                  padding: "9px 20px", borderRadius: 8, border: "none",
                  background: confirmed ? "#f43f5e" : "rgba(244,63,94,0.25)",
                  color: confirmed ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize: 13, fontWeight: 700,
                  cursor: confirmed && !isDeleting ? "pointer" : "not-allowed",
                  display: "flex", alignItems: "center", gap: 7,
                  transition: "background 200ms",
                }}
              >
                {isDeleting
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Deleting&hellip;</>
                  : <><Trash2 size={13} /> Delete Brand</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes brandModalIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
