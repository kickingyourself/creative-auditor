/**
 * app/competitive/new/page.tsx
 * Comparison builder — start a fresh comparison with no pre-selected campaigns.
 */

import type { Metadata } from "next";
import { ComparisonBuilder, type CampaignOption } from "@/components/ComparisonBuilder";

export const metadata: Metadata = {
  title: "New Comparison | Creative Audit",
  description: "Build a side-by-side competitive ad creative comparison.",
};

async function getAllCampaigns(): Promise<CampaignOption[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/campaigns/all`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json() as { campaigns: CampaignOption[] };
    return json.campaigns;
  } catch { return []; }
}

export default async function NewComparisonPage() {
  const allCampaigns = await getAllCampaigns();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <ComparisonBuilder allCampaigns={allCampaigns} />
    </div>
  );
}
