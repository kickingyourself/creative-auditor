/**
 * app/competitive/new/page.tsx
 * Comparison builder — start a fresh comparison with no pre-selected campaigns.
 */

import type { Metadata } from "next";
import { createServerClient } from "@/utils/supabase/server";
import { ComparisonBuilder, type CampaignOption } from "@/components/ComparisonBuilder";

export const metadata: Metadata = {
  title: "New Comparison | Creative Audit",
  description: "Build a side-by-side competitive ad creative comparison.",
};

export default async function NewComparisonPage() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, brand_id, brands(id, name, logo_url)")
    .order("name", { ascending: true });

  const allCampaigns = ((data ?? []) as unknown as CampaignOption[]).sort((a, b) => {
    const ba = a.brands?.name ?? "";
    const bb = b.brands?.name ?? "";
    return ba.localeCompare(bb) || a.name.localeCompare(b.name);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <ComparisonBuilder allCampaigns={allCampaigns} />
    </div>
  );
}
