/**
 * app/competitive/page.tsx
 * Lists saved competitive snapshots. Server component.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { createServerClient } from "@/utils/supabase/server";
import { SnapshotGrid } from "@/components/SnapshotGrid";

export const metadata: Metadata = {
  title: "Competitive Analysis | Creative Audit",
  description: "Compare ad creative across brands and campaigns side by side.",
};

export const revalidate = 0;

export default async function CompetitivePage() {
  const supabase = await createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snapshots } = await (supabase.from("competitive_snapshots") as any)
    .select("id, name, campaign_ids, preview_data, created_at")
    .order("created_at", { ascending: false });

  return (
    <div style={{ padding: "28px 28px 60px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--color-text-primary)", letterSpacing: "-0.03em", marginBottom: 4 }}>
            Competitive Analysis
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
            Compare creative strategies across brands and campaigns.
          </p>
        </div>
        <Link
          href="/competitive/new"
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "10px 18px", borderRadius: 8, border: "none",
            background: "var(--color-accent)", color: "#0a1a1b",
            fontSize: 13, fontWeight: 700, textDecoration: "none",
          }}
        >
          + New Comparison
        </Link>
      </div>

      {(!snapshots || snapshots.length === 0) ? (
        <div style={{
          padding: "80px 24px", textAlign: "center",
          border: "2px dashed var(--color-border)", borderRadius: 16,
        }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>
            No saved comparisons yet
          </p>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 20 }}>
            Build a side-by-side campaign comparison and save it as a snapshot.
          </p>
          <Link
            href="/competitive/new"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px", borderRadius: 8,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)", color: "var(--color-text-primary)",
              fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}
          >
            Start comparing →
          </Link>
        </div>
      ) : (
        <SnapshotGrid snapshots={snapshots} />
      )}
    </div>
  );
}
