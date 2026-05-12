/**
 * app/competitive/[id]/page.tsx
 * View / edit a saved competitive snapshot.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerClient } from "@/utils/supabase/server";
import { ComparisonBuilder, type CampaignOption } from "@/components/ComparisonBuilder";

export const revalidate = 0;

async function getAllCampaigns(): Promise<CampaignOption[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/campaigns/all`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json() as { campaigns: CampaignOption[] };
    return json.campaigns;
  } catch { return []; }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from("competitive_snapshots") as any)
    .select("name").eq("id", id).single();
  return {
    title: data ? `${data.name} | Competitive Analysis` : "Competitive Analysis",
  };
}

export default async function SnapshotPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snapshot, error } = await (supabase.from("competitive_snapshots") as any)
    .select("id, name, campaign_ids, created_at")
    .eq("id", id)
    .single();

  if (error || !snapshot) return notFound();

  const allCampaigns = await getAllCampaigns();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <ComparisonBuilder
        allCampaigns={allCampaigns}
        initialCampaignIds={snapshot.campaign_ids as string[]}
        snapshotId={snapshot.id as string}
        snapshotName={snapshot.name as string}
      />
    </div>
  );
}
