"use client";

import { useState, useCallback } from "react";
import { Creative } from "@/types";
import {
  PlayCircle,
  Smartphone,
  Globe,
  Share2,
  Eye,
  Heart,
  MessageCircle,
  Clock,
  Play,
  TrendingUp,
  Image,
  Camera,
  Trash2,
  Pencil,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { EditCreativeModal } from "./EditCreativeModal";
import type { EditCreativePayload } from "./EditCreativeModal";

const PLATFORM_CONFIG: Record<
  Creative["platform"],
  { icon: React.ElementType; label: string; color: string; bg: string }
> = {
  youtube: {
    icon: PlayCircle,
    label: "YouTube",
    color: "#ff4444",
    bg: "rgba(255,68,68,0.12)",
  },
  tiktok: {
    icon: Smartphone,
    label: "TikTok",
    color: "#69c9d0",
    bg: "rgba(105,201,208,0.12)",
  },
  homepage: {
    icon: Camera,
    label: "Homepage",
    color: "#22d3a0",
    bg: "rgba(34,211,160,0.12)",
  },
  social: {
    icon: Share2,
    label: "Social",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.12)",
  },
  meta: {
    icon: Share2,
    label: "Meta",
    color: "#1877f2",
    bg: "rgba(24,119,242,0.12)",
  },
  website: {
    icon: Globe,
    label: "Website",
    color: "#22d3a0",
    bg: "rgba(34,211,160,0.12)",
  },
  other: {
    icon: Globe,
    label: "Other",
    color: "#8888a8",
    bg: "rgba(136,136,168,0.12)",
  },
};

const AD_TYPE_ICON: Record<Creative["ad_type"], React.ElementType> = {
  video: Play,
  image: Image,
  carousel: Share2,
};

const STATUS_COLORS: Record<Creative["status"], string> = {
  active: "#22d3a0",
  inactive: "#8888a8",
  pending: "#f59e0b",
};

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatEngagement(r: number | null | undefined): string {
  if (r == null) return "—";
  return `${(r * 100).toFixed(2)}%`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

interface CreativeCardProps {
  creative: Creative;
  index?: number;
  brandLogoUrl?: string | null;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, patch: EditCreativePayload & { brand_name?: string; campaign_name?: string }) => void;
}

export function CreativeCard({ creative, index = 0, brandLogoUrl, onDelete, onUpdate }: CreativeCardProps) {
  const platform = PLATFORM_CONFIG[creative.platform];
  const PlatformIcon = platform.icon;
  const AdTypeIcon = AD_TYPE_ICON[creative.ad_type];

  // ── Delete flow state ──────────────────────────────────────────────────────
  const [hovered, setHovered]         = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting]   = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const confirmed = confirmText.trim().toUpperCase() === "DELETE";

  const openModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmText(""); setDeleteError(null); setShowModal(true);
  }, []);

  const openEditModal = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditModal(true);
  }, []);

  const closeModal = useCallback(() => {
    if (isDeleting) return;
    setShowModal(false); setConfirmText(""); setDeleteError(null);
  }, [isDeleting]);

  async function handleDelete() {
    if (!confirmed || isDeleting) return;
    setIsDeleting(true); setDeleteError(null);
    try {
      const res  = await fetch(`/api/creatives/${creative.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError(json?.detail ?? json?.error ?? "Delete failed.");
        setIsDeleting(false);
        return;
      }
      setShowModal(false);
      onDelete?.(creative.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Network error.");
      setIsDeleting(false);
    }
  }

  return (
    <>
    <article
      id={`creative-card-${creative.id}`}
      className="animate-fade-in-up"
      style={{
        animationDelay: `${index * 60}ms`,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "14px",
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform var(--transition-base), border-color var(--transition-base), box-shadow var(--transition-base)",
        breakInside: "avoid",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(-4px)";
        el.style.borderColor = "rgba(79, 179, 186, 0.35)";
        el.style.boxShadow = "0 8px 32px rgba(79, 179, 186, 0.15)";
        setHovered(true);
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "translateY(0)";
        el.style.borderColor = "var(--color-border)";
        el.style.boxShadow = "none";
        setHovered(false);
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingTop: "56.25%",
          background: "var(--color-surface-2)",
          overflow: "hidden",
        }}
      >
        {creative.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={creative.thumbnail_url}
            alt={creative.title}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${platform.bg}, var(--color-surface-2))`,
            }}
          >
            <AdTypeIcon size={32} color={platform.color} />
          </div>
        )}

        {/* Duration badge */}
        {creative.duration_seconds && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              right: 8,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(4px)",
              borderRadius: "4px",
              padding: "2px 6px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              fontWeight: 600,
              color: "#fff",
            }}
          >
            <Clock size={10} />
            {formatDuration(creative.duration_seconds)}
          </div>
        )}

        {/* Platform badge */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: platform.bg,
            backdropFilter: "blur(8px)",
            border: `1px solid ${platform.color}30`,
            borderRadius: "6px",
            padding: "4px 8px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            fontWeight: 600,
            color: platform.color,
          }}
        >
          <PlatformIcon size={11} />
          {platform.label}
        </div>

        {/* Top-right controls: edit + delete buttons + status dot */}
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 6 }}>
          {/* Edit button */}
          <button
            onClick={openEditModal}
            title="Edit creative"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28,
              background: "rgba(79,179,186,0.85)",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(79,179,186,0.4)",
              borderRadius: "7px",
              cursor: "pointer",
              opacity: hovered ? 1 : 0,
              transform: hovered ? "scale(1)" : "scale(0.8)",
              transition: "opacity 180ms ease, transform 180ms ease",
              pointerEvents: hovered ? "auto" : "none",
            }}
          >
            <Pencil size={12} color="#fff" />
          </button>

          {/* Delete button — reveals on hover */}
          <button
            onClick={openModal}
            title="Delete creative"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28,
              background: "rgba(244,63,94,0.85)",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(244,63,94,0.4)",
              borderRadius: "7px",
              cursor: "pointer",
              opacity: hovered ? 1 : 0,
              transform: hovered ? "scale(1)" : "scale(0.8)",
              transition: "opacity 180ms ease, transform 180ms ease",
              pointerEvents: hovered ? "auto" : "none",
            }}
          >
            <Trash2 size={13} color="#fff" />
          </button>

          {/* Status dot */}
          <div
            style={{
              width: 8, height: 8,
              borderRadius: "50%",
              background: STATUS_COLORS[creative.status],
              boxShadow: `0 0 6px ${STATUS_COLORS[creative.status]}`,
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
        {/* Title */}
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {creative.title}
        </h3>

        {/* Metrics */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "8px",
          }}
        >
          {[
            { icon: Eye,           value: formatNumber(creative.views),           label: "Views" },
            { icon: Heart,         value: formatNumber(creative.likes),           label: "Likes" },
            { icon: MessageCircle, value: formatEngagement(creative.engagement_rate), label: "Engmt" },
          ].map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              style={{
                background: "var(--color-surface-2)",
                borderRadius: "8px",
                padding: "8px",
                textAlign: "center",
              }}
            >
              <Icon
                size={12}
                color="var(--color-text-muted)"
                style={{ marginBottom: "3px" }}
              />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--color-text-primary)",
                  lineHeight: 1,
                }}
              >
                {value}
              </p>
              <p
                style={{
                  fontSize: "9px",
                  color: "var(--color-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginTop: "2px",
                }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {creative.brand_name && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandLogoUrl}
                    alt={creative.brand_name}
                    style={{ width: 16, height: 16, borderRadius: 3, objectFit: "contain", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 16, height: 16, borderRadius: 3,
                    background: platform.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "8px", fontWeight: 800, color: platform.color, flexShrink: 0,
                  }}>
                    {creative.brand_name[0]?.toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-secondary)" }}>
                  {creative.brand_name}
                </span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "5px",
              fontSize: "11px", color: "var(--color-text-muted)" }}>
              <TrendingUp size={11} />
              <span>
                {creative.published_at
                  ? new Date(creative.published_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })
                  : extractDomain(creative.source_url)}
              </span>
            </div>
          </div>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              color: platform.color,
              background: platform.bg,
              borderRadius: "4px",
              padding: "2px 7px",
              textTransform: "capitalize",
            }}
          >
            {creative.ad_type}
          </span>
        </div>
      </div>
    </article>

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
            borderRadius: 16,
            padding: 28,
            maxWidth: 440,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            animation: "deleteModalIn 200ms cubic-bezier(0.34,1.56,0.64,1) both",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: "rgba(244,63,94,0.12)",
              border: "1px solid rgba(244,63,94,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AlertTriangle size={18} color="#f43f5e" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.3 }}>
                Delete this creative?
              </p>
              <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                This permanently removes the asset from the database and storage.
                <strong style={{ color: "#f43f5e" }}> This cannot be undone.</strong>
              </p>
            </div>
          </div>

          {/* Preview */}
          {creative.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creative.thumbnail_url}
              alt=""
              style={{
                width: "100%", height: 120, objectFit: "cover",
                borderRadius: 8, border: "1px solid var(--color-border)",
              }}
            />
          )}

          {/* Confirmation input */}
          <div>
            <label
              htmlFor={`delete-confirm-${creative.id}`}
              style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 8 }}
            >
              Type <code style={{
                background: "rgba(244,63,94,0.12)", color: "#f43f5e",
                padding: "1px 5px", borderRadius: 4, fontFamily: "monospace",
              }}>DELETE</code> to confirm
            </label>
            <input
              id={`delete-confirm-${creative.id}`}
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && confirmed) handleDelete(); if (e.key === "Escape") closeModal(); }}
              placeholder="DELETE"
              autoFocus
              autoComplete="off"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "var(--color-surface-2)",
                border: `1px solid ${confirmed ? "rgba(244,63,94,0.6)" : "var(--color-border)"}`,
                borderRadius: 8, padding: "10px 12px",
                color: confirmed ? "#f43f5e" : "var(--color-text-primary)",
                fontSize: 13, fontFamily: "monospace", outline: "none",
                transition: "border-color 200ms, color 200ms",
              }}
            />
          </div>

          {/* Error */}
          {deleteError && (
            <p style={{ fontSize: 12, color: "#f43f5e", background: "rgba(244,63,94,0.08)", padding: "8px 12px", borderRadius: 6 }}>
              {deleteError}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              onClick={closeModal}
              disabled={isDeleting}
              style={{
                padding: "9px 18px", borderRadius: 8, border: "1px solid var(--color-border)",
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
                padding: "9px 18px", borderRadius: 8, border: "none",
                background: confirmed ? "#f43f5e" : "rgba(244,63,94,0.25)",
                color: confirmed ? "#fff" : "rgba(255,255,255,0.4)",
                fontSize: 13, fontWeight: 700,
                cursor: confirmed && !isDeleting ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 7,
                transition: "background 200ms",
                boxShadow: confirmed ? "0 4px 14px rgba(244,63,94,0.35)" : "none",
              }}
            >
              {isDeleting
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Deleting…</>
                : <><Trash2 size={13} /> Delete</>}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Edit creative modal ──────────────────────────────────────────────── */}
    {showEditModal && (
      <EditCreativeModal
        creative={creative}
        onClose={() => setShowEditModal(false)}
        onSave={(id, patch) => {
          setShowEditModal(false);
          onUpdate?.(id, patch);
        }}
      />
    )}

    <style>{`
      @keyframes deleteModalIn {
        from { opacity: 0; transform: scale(0.92) translateY(8px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `}</style>
    </>
  );
}
