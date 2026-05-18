"use client";

/**
 * app/campaigns/new/page.tsx
 *
 * Campaign Builder — client component.
 * - Clicking any "Add creative" tile in the Landing Page section opens
 *   LandingPageModal (URL capture via Playwright OR file upload).
 * - All other channel tiles remain static placeholders for now.
 */

import { useState } from "react";
import {
  Layers, ChevronRight, Plus,
  Globe, PlayCircle, LayoutGrid, Music2, Image,
  Monitor, MapPin, Tv2, Calendar, Tag, AlignLeft,
} from "lucide-react";
import Link from "next/link";
import { LandingPageModal } from "@/components/LandingPageModal";
import { YouTubeModal } from "@/components/YouTubeModal";
import { ChannelModal, type ChannelConfig } from "@/components/ChannelModal";
import { PinterestModal } from "@/components/PinterestModal";

// ── Channel taxonomy ──────────────────────────────────────────────────────────

const CHANNELS: {
  key: string; label: string;
  icon: React.ElementType; description: string; slots: number;
}[] = [
  { key: "landing_page", label: "Landing Page",  icon: Globe,       description: "Brand homepage or campaign landing URL", slots: 1 },
  { key: "youtube",      label: "YouTube",        icon: PlayCircle,  description: "Long-form video ads and pre-rolls",      slots: 3 },
  { key: "meta",         label: "Meta",           icon: LayoutGrid,  description: "Facebook & Instagram feed, stories and reels", slots: 4 },
  { key: "tiktok",       label: "TikTok",         icon: Music2,      description: "Short-form vertical video",              slots: 3 },
  { key: "pinterest",    label: "Pinterest",      icon: Image,       description: "Pins, promoted video and collections",   slots: 3 },
  { key: "programmatic", label: "Programmatic",   icon: Monitor,     description: "Display banners and native placements",  slots: 4 },
  { key: "ooh",          label: "OOH",            icon: MapPin,      description: "Out-of-home, DOOH and transit",          slots: 2 },
  { key: "tvc",          label: "TVC",            icon: Tv2,         description: "Television commercials and broadcast",   slots: 2 },
];

// ── Placeholder tile ──────────────────────────────────────────────────────────

function PlaceholderTile({
  tall = false,
  onClick,
  interactive = false,
}: {
  tall?: boolean;
  onClick?: () => void;
  interactive?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 10, width: "100%",
        minHeight: tall ? 260 : 170,
        border: hovered
          ? "1.5px dashed var(--color-accent)"
          : "1.5px dashed var(--color-border)",
        borderRadius: 14,
        background: hovered ? "rgba(79,179,186,0.04)" : "rgba(255,255,255,0.015)",
        color: hovered ? "var(--color-accent)" : "var(--color-text-muted)",
        cursor: interactive ? "pointer" : "default",
        transition: "all 200ms ease",
        outline: "none",
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: hovered
          ? "1.5px dashed rgba(79,179,186,0.6)"
          : "1.5px dashed rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 200ms ease",
      }}>
        <Plus
          size={20} strokeWidth={1.8}
          color={hovered ? "var(--color-accent)" : "rgba(255,255,255,0.2)"}
        />
      </div>
      <span style={{
        fontSize: 12, fontWeight: 600, letterSpacing: "0.02em",
        color: hovered ? "var(--color-accent)" : "rgba(255,255,255,0.18)",
        transition: "color 200ms ease",
      }}>
        Add creative
      </span>
    </button>
  );
}

// ── Hero placeholder ──────────────────────────────────────────────────────────

function HeroPlaceholder() {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: "rgba(251,191,36,0.1)",
          border: "1px solid rgba(251,191,36,0.25)",
          padding: "3px 10px", borderRadius: 20,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(251,191,36,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Hero Creative
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Pin your campaign&apos;s headline asset here
        </span>
      </div>
      <div style={{
        width: "100%", height: 340, borderRadius: 18,
        border: "1.5px dashed rgba(251,191,36,0.25)",
        background: "rgba(251,191,36,0.025)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(251,191,36,0.35)", marginBottom: 6 }}>
            No hero selected
          </p>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", maxWidth: 280, lineHeight: 1.5 }}>
            Upload a creative below, then pin it here as your campaign&apos;s headline asset
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar meta field ────────────────────────────────────────────────────────

function MetaField({ icon: Icon, label, placeholder }: { icon: React.ElementType; label: string; placeholder: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <Icon size={12} color="var(--color-text-muted)" />
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </span>
      </div>
      <div style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", fontSize: 13, color: "var(--color-text-muted)", fontStyle: "italic" }}>
        {placeholder}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const [modalOpen,    setModalOpen]    = useState(false);
  const [ytModalOpen,  setYtModalOpen]  = useState(false);
  const [metaOpen,       setMetaOpen]       = useState(false);
  const [tiktokOpen,     setTiktokOpen]     = useState(false);
  const [pinterestOpen,  setPinterestOpen]  = useState(false);

  const META_CONFIG: ChannelConfig = {
    platform:    "meta",
    label:       "Meta",
    icon:        <LayoutGrid size={15} color="#1877f2" />,
    accentColor: "#1877f2",
    accentBg:    "rgba(24,119,242,0.10)",
  };
  const TIKTOK_CONFIG: ChannelConfig = {
    platform:    "tiktok",
    label:       "TikTok",
    icon:        <Music2 size={15} color="#ff0050" />,
    accentColor: "#ff0050",
    accentBg:    "rgba(255,0,80,0.10)",
  };

  // TODO: these will come from the campaign form state once the sidebar is wired up.
  // For now, a placeholder brandId is required by ScrapeForm / upload APIs.
  // Pass empty string — ScrapeForm will show a MISSING_BRAND error guiding the user.
  const brandId = "";
  const campaignId = null;

  return (
    <div style={{ padding: "28px 28px 80px", maxWidth: 1440, margin: "0 auto" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        <Link href="/campaigns" style={{ fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
          <Layers size={13} color="var(--color-accent)" />
          Campaigns
        </Link>
        <ChevronRight size={13} color="var(--color-text-muted)" />
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>New Campaign</span>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, border: "1.5px dashed var(--color-border)", background: "var(--color-surface-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Tag size={12} color="var(--color-text-muted)" />
          </div>
          <div style={{ padding: "3px 12px", borderRadius: 6, border: "1px dashed var(--color-border)", fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)", fontStyle: "italic" }}>
            Select brand…
          </div>
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, color: "var(--color-text-muted)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 8, fontStyle: "italic", borderBottom: "1.5px dashed var(--color-border)", paddingBottom: 8, display: "inline-flex", alignItems: "center", gap: 10, minWidth: 340 }}>
          Campaign name…
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 6 }}>0 creatives across 0 channels</p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 28, alignItems: "start" }}>

        {/* Left: channel canvas */}
        <div>
          <HeroPlaceholder />

          {CHANNELS.map((ch) => {
            const Icon = ch.icon;
            const isLandingPage = ch.key === "landing_page";
            return (
              <section key={ch.key} style={{ marginBottom: 48 }}>
                {/* Section header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(79,179,186,0.08)", border: "1px solid rgba(79,179,186,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={14} color="var(--color-accent)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{ch.label}</h2>
                    <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{ch.description}</p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", padding: "2px 8px", borderRadius: 20 }}>0</span>
                </div>

                {/* Tile grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                  {Array.from({ length: ch.slots }).map((_, idx) => (
                    <PlaceholderTile
                      key={idx}
                      tall={isLandingPage}
                      interactive={isLandingPage || ch.key === "youtube" || ch.key === "meta" || ch.key === "tiktok" || ch.key === "pinterest"}
                      onClick={
                      isLandingPage        ? () => setModalOpen(true)       :
                      ch.key === "youtube"  ? () => setYtModalOpen(true)    :
                      ch.key === "meta"     ? () => setMetaOpen(true)       :
                      ch.key === "tiktok"   ? () => setTiktokOpen(true)     :
                      ch.key === "pinterest"? () => setPinterestOpen(true)  :
                      undefined
                    }
                    />
                  ))}
                </div>

                <div style={{ marginTop: 24, height: 1, background: "var(--color-border)", opacity: 0.4 }} />
              </section>
            );
          })}
        </div>

        {/* Right: sidebar */}
        <div style={{ position: "sticky", top: "calc(var(--header-height) + 28px)" }}>
          {/* Campaign Details */}
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 18 }}>Campaign Details</p>
            <MetaField icon={Tag}       label="Brand"       placeholder="Select brand…" />
            <MetaField icon={AlignLeft} label="Description" placeholder="Optional campaign brief…" />
            <MetaField icon={Calendar}  label="Start Date"  placeholder="dd / mm / yyyy" />

            {/* Status */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-text-muted)" }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Draft", "Active", "Archived"].map((s) => (
                  <div key={s} style={{
                    flex: 1, padding: "7px 0", borderRadius: 8, textAlign: "center",
                    border: s === "Draft" ? "1px solid rgba(79,179,186,0.4)" : "1px solid var(--color-border)",
                    background: s === "Draft" ? "rgba(79,179,186,0.08)" : "transparent",
                    fontSize: 11, fontWeight: 600,
                    color: s === "Draft" ? "var(--color-accent)" : "var(--color-text-muted)",
                    cursor: "default",
                  }}>{s}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Channel Coverage */}
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Channel Coverage</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {CHANNELS.map((ch) => {
                const Icon = ch.icon;
                return (
                  <div key={ch.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon size={12} color="var(--color-text-muted)" />
                      <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{ch.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", background: "var(--color-surface-2)", padding: "1px 7px", borderRadius: 10 }}>0</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ width: "100%", padding: "12px", borderRadius: 10, background: "rgba(79,179,186,0.12)", border: "1px solid rgba(79,179,186,0.2)", fontSize: 13, fontWeight: 700, color: "rgba(79,179,186,0.4)", textAlign: "center", cursor: "default", letterSpacing: "0.01em" }}>
              Save Campaign
            </div>
            <div style={{ width: "100%", padding: "10px", borderRadius: 10, border: "1px solid var(--color-border)", fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textAlign: "center", cursor: "default" }}>
              Save as Draft
            </div>
          </div>
        </div>
      </div>

      {/* Landing Page modal */}
      {modalOpen && (
        <LandingPageModal
          brandId={brandId} campaignId={campaignId}
          onClose={() => setModalOpen(false)}
          onSuccess={() => setModalOpen(false)}
        />
      )}
      {ytModalOpen && (
        <YouTubeModal
          brandId={brandId} campaignId={campaignId}
          onClose={() => setYtModalOpen(false)}
          onSuccess={() => setYtModalOpen(false)}
        />
      )}
      {metaOpen && (
        <ChannelModal
          config={META_CONFIG}
          brandId={brandId} campaignId={campaignId}
          onClose={() => setMetaOpen(false)}
          onSuccess={() => setMetaOpen(false)}
        />
      )}
      {tiktokOpen && (
        <ChannelModal
          config={TIKTOK_CONFIG}
          brandId={brandId} campaignId={campaignId}
          onClose={() => setTiktokOpen(false)}
          onSuccess={() => setTiktokOpen(false)}
        />
      )}
      {pinterestOpen && (
        <PinterestModal
          brandId={brandId} campaignId={campaignId}
          onClose={() => setPinterestOpen(false)}
          onSuccess={() => setPinterestOpen(false)}
        />
      )}
    </div>
  );
}
