/**
 * app/campaigns/page.tsx
 *
 * Campaigns list — server-rendered table of all campaigns in the database,
 * with brand info, creative counts, and delete controls.
 */

import type { Metadata } from "next";
import { createServerClient } from "@/utils/supabase/server";
import { CampaignTable, type CampaignRow } from "@/components/CampaignTable";
import { Layers } from "lucide-react";

export const metadata: Metadata = {
  title: "Campaigns | Creative Audit",
  description: "All ad campaigns across every brand, with creative counts and management tools.",
};

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const supabase = createServerClient();

  // Fetch all campaigns with brand info and a creative count
  const { data, error } = await supabase
    .from("campaigns")
    .select(`
      id,
      name,
      brand_id,
      start_date,
      end_date,
      created_at,
      brands(name, logo_url),
      creatives!campaign_id(id)
    `)
    .order("created_at", { ascending: false });

  const campaigns: CampaignRow[] = ((data ?? []) as unknown as {
    id: string;
    name: string;
    brand_id: string;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
    brands: { name: string; logo_url: string | null } | null;
    creatives: { id: string }[] | null;
  }[]).map((row) => ({
    id:             row.id,
    name:           row.name,
    brand_id:       row.brand_id,
    brand_name:     row.brands?.name ?? "Unknown",
    brand_logo_url: row.brands?.logo_url ?? null,
    creative_count: row.creatives?.length ?? 0,
    start_date:     row.start_date,
    end_date:       row.end_date,
    created_at:     row.created_at,
  }));

  return (
    <div style={{ padding: "28px 28px 80px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Layers size={20} color="var(--color-accent)" />
          <h1 style={{
            fontSize: 22, fontWeight: 700,
            color: "var(--color-text-primary)",
            letterSpacing: "-0.025em",
          }}>
            Campaigns
          </h1>
        </div>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
          {error
            ? "Could not load campaigns."
            : `${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""} across your brand library`}
        </p>
      </div>

      {error ? (
        <div style={{
          padding: "14px 18px",
          background: "rgba(244,63,94,0.08)",
          border: "1px solid rgba(244,63,94,0.2)",
          borderRadius: 10, fontSize: 13, color: "#f43f5e",
        }}>
          ⚠️ {error.message}
        </div>
      ) : (
        <CampaignTable initialCampaigns={campaigns} />
      )}
    </div>
  );
}
