"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, BarChart2, Calendar, ImageIcon } from "lucide-react";

export interface SnapshotPreviewCampaign {
  id: string;
  name: string;
  brand_name: string | null;
  brand_logo_url: string | null;
  first_thumbnail: string | null;
}

export interface SnapshotCardData {
  id: string;
  name: string;
  campaign_ids: string[];
  preview_data: { campaigns: SnapshotPreviewCampaign[] } | null;
  created_at: string;
}

interface Props {
  snapshot: SnapshotCardData;
  onDelete: (id: string) => void;
}

export function SnapshotCard({ snapshot, onDelete }: Props) {
  const [hovered, setHovered] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const campaigns = snapshot.preview_data?.campaigns ?? [];
  // Pad to exactly 4 slots so the 2×2 grid always has all quadrants
  const thumbSlots = [...campaigns.map(c => c.first_thumbnail), null, null, null, null].slice(0, 4) as (string | null)[];
  const date = new Date(snapshot.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // At least one real thumbnail present
  const hasAnyThumb = thumbSlots.some(Boolean);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (deleting) return;
    setDeleting(true);
    await fetch(`/api/competitive-snapshots/${snapshot.id}`, { method: "DELETE" });
    onDelete(snapshot.id);
  }

  return (
    <Link
      href={`/competitive/${snapshot.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", flexDirection: "column",
        borderRadius: 14, overflow: "hidden",
        border: `1px solid ${hovered ? "rgba(79,179,186,0.5)" : "var(--color-border)"}`,
        background: "var(--color-surface)",
        textDecoration: "none",
        transition: "border-color 200ms ease",
        animation: "fadeInUp 0.3s ease both",
      }}
    >
      {/* ── Square thumbnail mosaic — matches CampaignSummaryGrid exactly ── */}
      <div style={{
        position: "relative",
        width: "100%",
        paddingBottom: "100%",   // 1:1 square
        flexShrink: 0,
        overflow: "hidden",
        background: "var(--color-surface-2)",
      }}>
        {!hasAnyThumb && (
          // Full-square empty state
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--color-surface-2)",
          }}>
            <BarChart2 size={36} color="var(--color-text-muted)" style={{ opacity: 0.25 }} />
          </div>
        )}
        {hasAnyThumb && thumbSlots.map((url, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top:    i < 2 ? 0 : "50%",
              left:   i % 2 === 0 ? 0 : "50%",
              width:  "50%",
              height: "50%",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--color-surface-2)",
            }}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <ImageIcon size={18} color="var(--color-border)" />
            )}
          </div>
        ))}
      </div>

      {/* Card body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {snapshot.name}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
              <Calendar size={11} color="var(--color-text-muted)" />
              <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{date}</span>
            </div>
          </div>

          <button
            onClick={handleDelete}
            title="Delete snapshot"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: 6,
              background: hovered ? "rgba(244,63,94,0.1)" : "none",
              border: hovered ? "1px solid rgba(244,63,94,0.25)" : "1px solid transparent",
              cursor: "pointer", flexShrink: 0,
              opacity: hovered ? 1 : 0, transition: "opacity 150ms ease, background 150ms ease",
            }}
          >
            <Trash2 size={12} color={deleting ? "var(--color-text-muted)" : "#f43f5e"} />
          </button>
        </div>

        {/* Brand + campaign chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {campaigns.map(c => (
            <div key={c.id} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "3px 8px", borderRadius: 6,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
            }}>
              {c.brand_logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.brand_logo_url} alt="" style={{ width: 12, height: 12, borderRadius: 2, objectFit: "contain" }} />
              ) : (
                <div style={{ width: 12, height: 12, borderRadius: 2, background: "rgba(79,179,186,0.2)" }} />
              )}
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                {c.brand_name ?? "—"} · {c.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes fadeInUp { from { opacity:0;transform:translateY(10px);} to { opacity:1;transform:none;}}`}</style>
    </Link>
  );
}
