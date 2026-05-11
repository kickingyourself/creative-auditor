"use client";

/**
 * components/AddCreativeTile.tsx
 *
 * A dashed "+" tile rendered after the last creative grid on a campaign page.
 * Clicking it opens AddCreativeModal with the BrandIngestPanel pre-scoped to
 * the current brand and campaign.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import { AddCreativeModal } from "@/components/AddCreativeModal";

interface Props {
  brandId: string;
  brandName: string;
  brandLogoUrl?: string | null;
  campaignId: string;
  campaignName: string;
}

export function AddCreativeTile({
  brandId,
  brandName,
  brandLogoUrl,
  campaignName,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        id="add-creative-tile"
        aria-label="Add creative"
        onClick={() => setOpen(true)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          width: "100%",
          minHeight: 160,
          border: "1.5px dashed var(--color-border)",
          borderRadius: "14px",
          background: "transparent",
          cursor: "pointer",
          color: "var(--color-text-muted)",
          transition: "border-color 200ms ease, background 200ms ease, color 200ms ease, transform 150ms ease",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = "var(--color-accent)";
          el.style.background = "rgba(34,211,160,0.04)";
          el.style.color = "var(--color-accent)";
          el.style.transform = "scale(1.015)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = "var(--color-border)";
          el.style.background = "transparent";
          el.style.color = "var(--color-text-muted)";
          el.style.transform = "scale(1)";
        }}
      >
        {/* + circle */}
        <div style={{
          width: 40, height: 40,
          borderRadius: "50%",
          border: "1.5px dashed currentColor",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 150ms ease",
        }}>
          <Plus size={18} strokeWidth={2} />
        </div>
        <span style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em" }}>
          Add creative
        </span>
      </button>

      {open && (
        <AddCreativeModal
          brandId={brandId}
          brandName={brandName}
          brandLogoUrl={brandLogoUrl}
          campaignName={campaignName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
