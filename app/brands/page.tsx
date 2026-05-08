/**
 * app/brands/page.tsx
 *
 * Async Server Component — fetches brands from Supabase with creative counts.
 * The "Add Brand" button is extracted to AddBrandButton (Client Component)
 * so this page stays a pure Server Component.
 */

import type { Metadata } from "next";
import { Building2, Globe, TrendingUp } from "lucide-react";
import { createServerClient } from "@/utils/supabase/server";
import { BrandIngestPanel } from "@/components/BrandIngestPanel";
import { AddBrandButton } from "@/components/AddBrandButton";

export const metadata: Metadata = {
  title: "Brands — Creative Audit",
  description: "Manage tracked brands and capture homepage creative screenshots.",
};

// Brand row with creative count aggregated
interface BrandWithCount {
  id: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  created_at: string;
  creative_count: number;
}

// Deterministic color assignment from brand name
function brandColor(name: string): { color: string; bg: string; initials: string } {
  const palette = [
    { color: "#ff4444", bg: "rgba(255,68,68,0.12)" },
    { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    { color: "#38bdf8", bg: "rgba(56,189,248,0.12)" },
    { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
    { color: "#22d3a0", bg: "rgba(34,211,160,0.12)" },
    { color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
    { color: "#e879f9", bg: "rgba(232,121,249,0.12)" },
    { color: "#4fb3ba", bg: "rgba(79,179,186,0.12)" },
  ];
  const idx = name.charCodeAt(0) % palette.length;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  return { ...palette[idx], initials };
}

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
            Click <strong>Add Brand</strong> to start tracking a brand's creative output.
          </p>
        </div>
      )}

      {/* Brand grid */}
      {brands.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(480px, 1fr))",
          gap: "20px",
        }}>
          {brands.map((brand, i) => {
            const { color, bg, initials } = brandColor(brand.name);
            return (
              <section
                key={brand.id}
                id={`brand-card-${brand.id}`}
                style={{
                  display: "flex", flexDirection: "column",
                  border: "1px solid var(--color-border)",
                  borderRadius: "16px", overflow: "hidden",
                  animation: "fadeInUp 0.5s ease both",
                  animationDelay: `${i * 80}ms`,
                }}
              >
                {/* Brand header */}
                <div style={{
                  background: "var(--color-surface)", padding: "20px",
                  display: "flex", alignItems: "center", gap: "14px",
                  borderBottom: "1px solid var(--color-border)",
                }}>
                  {/* Logo / initials avatar */}
                  {brand.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brand.logo_url}
                      alt={brand.name}
                      style={{ width: 48, height: 48, borderRadius: "12px", objectFit: "contain", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 48, height: 48, borderRadius: "12px",
                      background: bg, border: `1px solid ${color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "14px", fontWeight: 800, color, flexShrink: 0,
                      letterSpacing: "-0.02em",
                    }}>
                      {initials}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{
                      fontSize: "15px", fontWeight: 700,
                      color: "var(--color-text-primary)", letterSpacing: "-0.02em",
                    }}>
                      {brand.name}
                    </h2>
                    {brand.website_url && (
                      <a
                        href={brand.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex", alignItems: "center", gap: "4px",
                          fontSize: "12px", color: "var(--color-text-muted)",
                          textDecoration: "none", marginTop: "2px",
                        }}
                      >
                        <Globe size={11} />
                        {brand.website_url.replace(/^https?:\/\//, "")}
                      </a>
                    )}
                  </div>

                  {/* Stats chips */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      fontSize: "12px", fontWeight: 700,
                      color: "var(--color-text-primary)",
                    }}>
                      <Building2 size={11} color="var(--color-text-muted)" />
                      {brand.creative_count.toLocaleString()} creative{brand.creative_count !== 1 ? "s" : ""}
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "5px",
                      fontSize: "11px", color: "var(--color-text-muted)",
                    }}>
                      <TrendingUp size={10} />
                      Added {new Date(brand.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>

                {/* Ingest panel */}
                <div style={{ background: "var(--color-bg)", padding: "16px" }}>
                  <BrandIngestPanel brandId={brand.id} brandName={brand.name} />
                </div>
              </section>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
