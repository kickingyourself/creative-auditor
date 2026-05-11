"use client";

/**
 * components/CreativeViewModal.tsx
 *
 * Full-size takeover modal for viewing a creative asset.
 * - Images: full-width, max 70vh height
 * - YouTube: embedded player (16:9 iframe)
 * - Other videos: <video> element with native controls
 * - Landing pages + YouTube: "Open original" link out
 * - Metadata card below the media
 * - ESC / backdrop click to close
 * - Rendered via createPortal at document.body
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ExternalLink,
  Eye,
  TrendingUp,
  Calendar,
  Building2,
  Layers,
  Play,
} from "lucide-react";
import { Creative } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getYouTubeEmbedUrl(sourceUrl: string): string | null {
  try {
    const url = new URL(sourceUrl);
    // youtube.com/watch?v=ID  or  youtu.be/ID  or  youtube.com/shorts/ID
    const videoId =
      url.searchParams.get("v") ??
      (url.hostname === "youtu.be" ? url.pathname.slice(1) : null) ??
      (url.pathname.startsWith("/shorts/") ? url.pathname.split("/shorts/")[1] : null) ??
      null;
    return videoId
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`
      : null;
  } catch {
    return null;
  }
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

const PLATFORM_COLORS: Record<string, { color: string; bg: string }> = {
  youtube:      { color: "#ef4444", bg: "rgba(239,68,68,0.14)" },
  homepage:     { color: "#38bdf8", bg: "rgba(56,189,248,0.14)" },
  tiktok:       { color: "#f472b6", bg: "rgba(244,114,182,0.14)" },
  meta:         { color: "#818cf8", bg: "rgba(129,140,248,0.14)" },
  social:       { color: "#a78bfa", bg: "rgba(167,139,250,0.14)" },
  programmatic: { color: "#fb923c", bg: "rgba(251,146,60,0.14)" },
  display:      { color: "#fb923c", bg: "rgba(251,146,60,0.14)" },
  tvc:          { color: "#fbbf24", bg: "rgba(251,191,36,0.14)" },
  tv:           { color: "#fbbf24", bg: "rgba(251,191,36,0.14)" },
  ooh:          { color: "#34d399", bg: "rgba(52,211,153,0.14)" },
  pinterest:    { color: "#f43f5e", bg: "rgba(244,63,94,0.14)" },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  creative: Creative;
  brandLogoUrl?: string | null;
  onClose: () => void;
}

export function CreativeViewModal({ creative, brandLogoUrl, onClose }: Props) {
  // Body scroll lock + ESC handler
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const isYouTube   = creative.platform === "youtube";
  const isHomepage  = creative.platform === "homepage";
  const showLink    = isYouTube || isHomepage;
  const embedUrl    = isYouTube ? getYouTubeEmbedUrl(creative.source_url) : null;
  const pc          = PLATFORM_COLORS[creative.platform] ?? { color: "var(--color-accent)", bg: "rgba(79,179,186,0.14)" };

  // Determine media type
  const isVideoEmbed  = isYouTube && embedUrl;
  const isNativeVideo = !isYouTube && creative.ad_type === "video" && !!creative.video_url;
  const isImage       = !isVideoEmbed && !isNativeVideo;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={creative.title ?? "Creative preview"}
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(10px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        overflowY: "auto",
      }}
    >
      {/* Content wrapper — stops backdrop click propagating */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 920,
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          animation: "viewModalIn 240ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* ── Top bar: title + controls ───────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "12px",
        }}>
          <p style={{
            fontSize: "13px", fontWeight: 500,
            color: "rgba(255,255,255,0.55)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {creative.brand_name && <span style={{ marginRight: 6 }}>{creative.brand_name}</span>}
            {creative.campaign_name && <span style={{ opacity: 0.5, marginRight: 6 }}>·</span>}
            {creative.campaign_name}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {/* Open original link */}
            {showLink && (
              <a
                href={creative.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "7px 14px", borderRadius: "8px",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff", fontSize: "12px", fontWeight: 600,
                  textDecoration: "none",
                  backdropFilter: "blur(8px)",
                  transition: "background 150ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              >
                <ExternalLink size={13} />
                {isYouTube ? "Open on YouTube" : "Open homepage"}
              </a>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              aria-label="Close preview"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: "8px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff", cursor: "pointer",
                backdropFilter: "blur(8px)",
                transition: "background 150ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* ── Media area ─────────────────────────────────────────────── */}
        <div style={{
          borderRadius: "16px",
          overflow: "hidden",
          background: "#000",
          border: "1px solid rgba(255,255,255,0.07)",
          lineHeight: 0,
        }}>
          {/* YouTube embed */}
          {isVideoEmbed && (
            <div style={{ aspectRatio: "16/9" }}>
              <iframe
                src={embedUrl!}
                style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                title={creative.title ?? "YouTube video"}
              />
            </div>
          )}

          {/* Native video */}
          {isNativeVideo && (
            <div style={{ aspectRatio: "16/9" }}>
              <video
                src={creative.video_url!}
                controls
                autoPlay
                playsInline
                style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
              />
            </div>
          )}

          {/* Image / screenshot */}
          {isImage && creative.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creative.thumbnail_url}
              alt={creative.title ?? ""}
              style={{
                width: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                display: "block",
              }}
            />
          )}

          {/* No media fallback */}
          {isImage && !creative.thumbnail_url && (
            <div style={{
              aspectRatio: "16/9",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
              color: "rgba(255,255,255,0.3)",
            }}>
              <Play size={40} style={{ opacity: 0.4 }} />
              <p style={{ fontSize: "13px" }}>No preview available</p>
            </div>
          )}
        </div>

        {/* ── Metadata card ──────────────────────────────────────────── */}
        <div style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "14px",
          overflow: "hidden",
        }}>
          {/* Title row */}
          <div style={{
            padding: "18px 22px 14px",
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", gap: "12px",
            borderBottom: "1px solid var(--color-border)",
          }}>
            <h2 style={{
              fontSize: "16px", fontWeight: 700,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em", lineHeight: 1.35,
              flex: 1,
            }}>
              {creative.title ?? "Untitled"}
            </h2>
            <span style={{
              flexShrink: 0,
              fontSize: "10px", fontWeight: 700,
              color: pc.color, background: pc.bg,
              padding: "4px 10px", borderRadius: "20px",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {creative.platform === "homepage" ? "Landing Page" : creative.platform}
            </span>
          </div>

          {/* Stats row */}
          <div style={{
            padding: "14px 22px 16px",
            display: "flex", flexWrap: "wrap", gap: "20px 40px",
          }}>
            {/* Brand */}
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              {brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brandLogoUrl} alt="" style={{ width: 18, height: 18, borderRadius: 3, objectFit: "contain", flexShrink: 0 }} />
              ) : (
                <Building2 size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
              )}
              <div>
                <p style={{ fontSize: "9px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1, marginBottom: "3px" }}>Brand</p>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1 }}>{creative.brand_name ?? "—"}</p>
              </div>
            </div>

            {/* Campaign */}
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <Layers size={14} color={creative.campaign_name ? "var(--color-accent)" : "var(--color-text-muted)"} style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "9px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1, marginBottom: "3px" }}>Campaign</p>
                <p style={{ fontSize: "13px", fontWeight: 600, color: creative.campaign_name ? "var(--color-accent)" : "var(--color-text-muted)", lineHeight: 1, fontStyle: creative.campaign_name ? "normal" : "italic" }}>
                  {creative.campaign_name ?? "Uncategorised"}
                </p>
              </div>
            </div>

            {/* Views */}
            {creative.views != null && (
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <Eye size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "9px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1, marginBottom: "3px" }}>Views</p>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1 }}>{fmtNum(creative.views)}</p>
                </div>
              </div>
            )}

            {/* Engagement */}
            {creative.engagement_rate != null && (
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <TrendingUp size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "9px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1, marginBottom: "3px" }}>Engagement</p>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1 }}>{(creative.engagement_rate * 100).toFixed(2)}%</p>
                </div>
              </div>
            )}

            {/* Ad type */}
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <Play size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "9px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1, marginBottom: "3px" }}>Type</p>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1, textTransform: "capitalize" }}>{creative.ad_type}</p>
              </div>
            </div>

            {/* Date added */}
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <Calendar size={14} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: "9px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1, marginBottom: "3px" }}>Added</p>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1 }}>{fmtDate(creative.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes viewModalIn {
          from { opacity: 0; transform: scale(0.96) translateY(14px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>,
    document.body
  );
}
