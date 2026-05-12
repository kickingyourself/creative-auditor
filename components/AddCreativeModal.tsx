"use client";

/**
 * components/AddCreativeModal.tsx
 *
 * Full-screen takeover modal that hosts BrandIngestPanel so users can
 * add new creatives to a campaign without leaving the campaign detail page.
 *
 * - Renders via createPortal at document.body
 * - ESC / backdrop click to close
 * - Shows brand + campaign context in the header
 * - BrandIngestPanel handles all channel tabs (Landing Page, YouTube,
 *   Facebook, Instagram, Pinterest) plus manual file upload
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Layers } from "lucide-react";
import { BrandIngestPanel } from "@/components/BrandIngestPanel";

interface Props {
  brandId: string;
  brandName: string;
  brandLogoUrl?: string | null;
  campaignName?: string | null;
  onClose: () => void;
}

export function AddCreativeModal({
  brandId,
  brandName,
  brandLogoUrl,
  campaignName,
  onClose,
}: Props) {
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

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add creative"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.82)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 24px 60px",
        overflowY: "auto",
      }}
    >
      {/* Panel — stops backdrop click propagating */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 680,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "20px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "addModalIn 240ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "12px",
          padding: "18px 22px",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          {/* Brand + campaign context */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            {brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brandLogoUrl}
                alt={brandName}
                style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain", flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: "var(--color-accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 800, color: "#0a1a1b",
              }}>
                {brandName[0]?.toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", lineHeight: 1 }}>
                {brandName}
              </p>
              {campaignName && (
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "3px" }}>
                  <Layers size={11} color="var(--color-accent)" />
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {campaignName}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: "8px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-secondary)", cursor: "pointer",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Ingest panel ──────────────────────────────────────────────── */}
        <div style={{ padding: "24px" }}>
          <BrandIngestPanel brandId={brandId} brandName={brandName} />
        </div>
      </div>

      <style>{`
        @keyframes addModalIn {
          from { opacity: 0; transform: scale(0.97) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>,
    document.body
  );
}
