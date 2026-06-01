"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Creative } from "@/types";
import {
  PlayCircle,
  Smartphone,
  Globe,
  Share2,
  Clock,
  Play,
  TrendingUp,
  Image,
  Camera,
  Trash2,
  Pencil,
  AlertTriangle,
  Loader2,
  Layers,
  Crown,
  Star,
} from "lucide-react";
import { EditCreativeModal } from "./EditCreativeModal";
import type { EditCreativePayload } from "./EditCreativeModal";
import { CreativeViewModal } from "./CreativeViewModal";
import { ScorecardModal } from "./ScorecardModal";
import { captureVideoFrame } from "@/lib/captureVideoFrame";

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
  landing_page: {
    icon: Camera,
    label: "Landing Page",
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
  pinterest: {
    icon: Share2,
    label: "Pinterest",
    color: "#e60023",
    bg: "rgba(230,0,35,0.12)",
  },
  programmatic: {
    icon: Globe,
    label: "Programmatic",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
  },
  ooh: {
    icon: Globe,
    label: "OOH",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.12)",
  },
  tvc: {
    icon: Globe,
    label: "TVC",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
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

/** True when source_url is a direct video file (e.g. Supabase Storage .mp4 upload). */
function isDirectVideoFile(url: string | null | undefined): boolean {
  if (!url) return false;
  try { return /\.(mp4|mov|webm|m4v|ogv|ogg)$/i.test(new URL(url).pathname); }
  catch { return false; }
}

interface CreativeCardProps {
  creative: Creative;
  index?: number;
  brandLogoUrl?: string | null;
  /** When present, a Score button is shown on the card. */
  campaignId?: string | null;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, patch: EditCreativePayload & { brand_name?: string; campaign_name?: string }) => void;
  /** Whether this creative is the campaign hero — shows crown in accent colour. */
  isHero?: boolean;
  /** Called when the user clicks the crown button. */
  onToggleHero?: (id: string) => void;
}

export function CreativeCard({ creative, index = 0, brandLogoUrl, campaignId, onDelete, onUpdate, isHero = false, onToggleHero }: CreativeCardProps) {
  const platform    = PLATFORM_CONFIG[creative.platform] ?? PLATFORM_CONFIG["other"];
  const PlatformIcon = platform.icon;
  const AdTypeIcon  = AD_TYPE_ICON[creative.ad_type] ?? Image;

  // ── Delete flow state ──────────────────────────────────────────────────────
  const [hovered, setHovered]                     = useState(false);
  const [showModal, setShowModal]                 = useState(false);
  const [confirmText, setConfirmText]             = useState("");
  const [isDeleting, setIsDeleting]               = useState(false);
  const [deleteError, setDeleteError]             = useState<string | null>(null);
  const [showEditModal, setShowEditModal]         = useState(false);
  const [showViewModal, setShowViewModal]         = useState(false);
  const [showScorecardModal, setShowScorecardModal] = useState(false);
  // Local thumbnail — set after lazy capture for uploaded videos with no thumbnail
  const [localThumbUrl, setLocalThumbUrl]         = useState<string | null>(null);
  const thumbGenerating = useState(false);
  const [isGenThumb, setIsGenThumb]       = thumbGenerating;

  // Lazy-generate thumbnail for uploaded videos that have none
  const handleVideoLoaded = useCallback(async (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (creative.thumbnail_url || localThumbUrl || isGenThumb) return;
    setIsGenThumb(true);
    try {
      const thumbBlob = await captureVideoFrame(creative.source_url);
      if (!thumbBlob) return;

      // Upload to Supabase Storage via a small server-side proxy
      const fd = new FormData();
      fd.append("file", thumbBlob, "thumb.jpg");
      fd.append("creative_id", creative.id);
      const res = await fetch("/api/creatives/thumbnail", { method: "POST", body: fd });
      if (!res.ok) return;
      const { thumbnail_url } = await res.json() as { thumbnail_url: string };
      setLocalThumbUrl(thumbnail_url);
    } catch {
      /* best-effort */
    } finally {
      setIsGenThumb(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creative.id, creative.source_url, creative.thumbnail_url, localThumbUrl]);

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
        transition: "transform var(--transition-base), border-color var(--transition-base)",
        breakInside: "avoid",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "rgba(79, 179, 186, 0.5)";
        setHovered(true);
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--color-border)";
        setHovered(false);
      }}
      onClick={() => setShowViewModal(true)}
    >
      {/* Thumbnail */}
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingTop: "48%",
          background: "var(--color-surface-2)",
          overflow: "hidden",
        }}
      >
        {(localThumbUrl || creative.thumbnail_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={localThumbUrl ?? creative.thumbnail_url!}
            alt={creative.title ?? ""}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : isDirectVideoFile(creative.source_url) ? (
          // Uploaded video — seek to 1s on load so the preview isn't a black frame
          <video
            src={creative.source_url}
            muted
            playsInline
            preload="auto"
            onLoadedData={(e) => {
              // Seek the visible element to 1s for a non-black preview frame
              const el = e.currentTarget;
              if (el.duration > 1) el.currentTime = 1;
              // Then lazily capture & persist the thumbnail
              handleVideoLoaded(e);
            }}
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

        {/* Top-right controls: hero crown + edit + delete buttons + status dot */}
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", alignItems: "center", gap: 6 }}>

          {/* Hero crown — always visible when isHero, hover-only otherwise */}
          {onToggleHero && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleHero(creative.id); }}
              title={isHero ? "Remove hero" : "Set as hero"}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28,
                background: isHero ? "rgba(251,191,36,0.9)" : "rgba(0,0,0,0.55)",
                backdropFilter: "blur(6px)",
                border: isHero ? "1px solid rgba(251,191,36,0.6)" : "1px solid rgba(255,255,255,0.15)",
                borderRadius: "7px",
                cursor: "pointer",
                opacity: isHero ? 1 : (hovered ? 1 : 0),
                transform: isHero ? "scale(1)" : (hovered ? "scale(1)" : "scale(0.8)"),
                transition: "opacity 180ms ease, transform 180ms ease, background 150ms ease",
                pointerEvents: isHero ? "auto" : (hovered ? "auto" : "none"),
              }}
            >
              <Crown size={12} color={isHero ? "#1a1a1a" : "#fff"} fill={isHero ? "#1a1a1a" : "none"} />
            </button>
          )}

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

          {/* Score button — only in campaign context */}
          {campaignId && (
            <button
              onClick={() => setShowScorecardModal(true)}
              title="Score this creative"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28,
                background: "rgba(245,158,11,0.85)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(245,158,11,0.4)",
                borderRadius: "7px",
                cursor: "pointer",
                opacity: hovered ? 1 : 0,
                transform: hovered ? "scale(1)" : "scale(0.8)",
                transition: "opacity 180ms ease, transform 180ms ease",
                pointerEvents: hovered ? "auto" : "none",
              }}
            >
              <Star size={12} color="#fff" fill="#fff" />
            </button>
          )}

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
              flexShrink: 0,
            }}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
        {/* Title */}
        <h3
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--color-text-primary)",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {creative.title}
        </h3>



        {/* Footer — Brand / Campaign / Date + ad_type */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginTop: "auto",
            gap: "6px",
          }}
        >
          {/* Left col: brand → campaign → date stacked */}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>

            {/* Brand */}
            {creative.brand_name && (
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                {brandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandLogoUrl}
                    alt={creative.brand_name}
                    style={{ width: 13, height: 13, borderRadius: 2, objectFit: "contain", flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 13, height: 13, borderRadius: 2,
                    background: platform.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "7px", fontWeight: 800, color: platform.color, flexShrink: 0,
                  }}>
                    {creative.brand_name[0]?.toUpperCase()}
                  </div>
                )}
                <span style={{
                  fontSize: "10px", fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {creative.brand_name}
                </span>
              </div>
            )}

            {/* Campaign */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Layers size={10} color={creative.campaign_name ? "var(--color-accent)" : "var(--color-text-muted)"} style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: "10px",
                fontWeight: creative.campaign_name ? 600 : 400,
                color: creative.campaign_name ? "var(--color-accent)" : "var(--color-text-muted)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontStyle: creative.campaign_name ? "normal" : "italic",
              }}>
                {creative.campaign_name ?? "No campaign"}
              </span>
            </div>

            {/* Date */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px",
              fontSize: "10px", color: "var(--color-text-muted)" }}>
              <TrendingUp size={10} />
              <span>
                {creative.published_at
                  ? new Date(creative.published_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })
                  : extractDomain(creative.source_url)}
              </span>
            </div>
          </div>

          {/* Right: ad_type pill */}
          <span
            style={{
              fontSize: "9px",
              fontWeight: 600,
              color: platform.color,
              background: platform.bg,
              borderRadius: "4px",
              padding: "2px 6px",
              textTransform: "capitalize",
              flexShrink: 0,
            }}
          >
            {creative.ad_type}
          </span>
        </div>
      </div>
    </article>

    {/* ── Delete confirmation modal ──────────────────────────────────── */}
    {showModal && typeof document !== "undefined" && createPortal(
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
                boxShadow: "none",
              }}
            >
              {isDeleting
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Deleting…</>
                : <><Trash2 size={13} /> Delete</>}
            </button>
          </div>
        </div>
      </div>,
      document.body
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

    {/* ── View modal ──────────────────────────────────────────── */}
    {showViewModal && (
      <CreativeViewModal
        creative={creative}
        brandLogoUrl={brandLogoUrl}
        onClose={() => setShowViewModal(false)}
      />
    )}

    {/* ── Scorecard modal ────────────────────────────────────── */}
    {showScorecardModal && campaignId && (
      <ScorecardModal
        creative={creative}
        campaignId={campaignId}
        onClose={() => setShowScorecardModal(false)}
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
