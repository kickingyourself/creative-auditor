"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, BarChart2, Calendar } from "lucide-react";

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
  const thumbs = campaigns.map(c => c.first_thumbnail).filter(Boolean) as string[];
  const date = new Date(snapshot.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
      {/* Thumbnail mosaic */}
      <div style={{
        display: "grid",
        gridTemplateColumns: thumbs.length > 1 ? "1fr 1fr" : "1fr",
        gap: 2, background: "var(--color-bg)",
        aspectRatio: "16/7",
      }}>
        {thumbs.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-2)" }}>
            <BarChart2 size={32} color="var(--color-text-muted)" style={{ opacity: 0.3 }} />
          </div>
        )}
        {thumbs.slice(0, 4).map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ))}
      </div>

      {/* Card body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
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
