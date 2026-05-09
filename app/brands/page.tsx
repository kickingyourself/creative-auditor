/**
 * app/brands/page.tsx
 *
 * Async Server Component — fetches brands from Supabase with creative counts.
 * The "Add Brand" button and brand cards are extracted to Client Components
 * so this page stays a pure Server Component.
 */

import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { createServerClient } from "@/utils/supabase/server";
import { BrandIngestPanel } from "@/components/BrandIngestPanel";
import { AddBrandButton } from "@/components/AddBrandButton";
import { BrandGrid } from "@/components/BrandGrid";
import type { BrandWithCount } from "@/components/BrandCard";

export const metadata: Metadata = {
  title: "Brands — Creative Audit",
  description: "Manage tracked brands and capture homepage creative screenshots.",
};

export default async function BrandsPage() {
  let brands: BrandWithCount[] = [];
  let dbError = false;

  try {
    const supabase = createServerClient();

    // Fetch brands ordered by creation date (newest first)
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, website_url, logo_url, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get creative counts per brand in a single query
    const { data: counts } = await supabase
      .from("creatives")
      .select("brand_id");

    const countMap: Record<string, number> = {};
    (counts ?? []).forEach((r) => {
      const c = r as { brand_id: string };
      countMap[c.brand_id] = (countMap[c.brand_id] ?? 0) + 1;
    });

    brands = ((data ?? []) as Omit<BrandWithCount, "creative_count">[]).map((b) => ({
      ...b,
      creative_count: countMap[b.id] ?? 0,
    }));
  } catch {
    dbError = true;
  }

  return (
    <div style={{ padding: "28px 28px 60px" }}>
      {/* Page header */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: "28px", flexWrap: "wrap", gap: "12px",
      }}>
        <div>
          <h1 style={{
            fontSize: "22px", fontWeight: 700,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.025em", marginBottom: "6px",
          }}>
            Brands
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-text-secondary)" }}>
            {brands.length > 0
              ? `${brands.length} brand${brands.length !== 1 ? "s" : ""} tracked — capture screenshots or ingest YouTube videos.`
              : "Manage tracked brands and capture homepage creative snapshots."}
          </p>
        </div>

        {/* Client Component — owns modal open state */}
        <AddBrandButton />
      </div>

      {/* DB error banner */}
      {dbError && (
        <div style={{
          padding: "14px 18px", marginBottom: "24px",
          background: "rgba(244,63,94,0.08)",
          border: "1px solid rgba(244,63,94,0.2)",
          borderRadius: "10px", fontSize: "13px", color: "#f43f5e",
        }}>
          ⚠️ Could not load brands. Check your Supabase credentials and run the migrations.
        </div>
      )}

      {/* Empty state */}
      {!dbError && brands.length === 0 && (
        <div style={{
          padding: "60px 24px", textAlign: "center",
          border: "1px dashed var(--color-border)", borderRadius: "16px",
        }}>
          <Building2 size={32} color="var(--color-text-muted)" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "8px" }}>
            No brands yet
          </p>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Click <strong>Add Brand</strong> to start tracking a brand&apos;s creative output.
          </p>
        </div>
      )}

      {/* Brand grid — client component owns deletion state */}
      {brands.length > 0 && <BrandGrid brands={brands} />}
    </div>
  );
}

