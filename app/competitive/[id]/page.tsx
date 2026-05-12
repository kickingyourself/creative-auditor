/**
 * app/competitive/[id]/page.tsx
 * View / edit a saved competitive snapshot.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerClient } from "@/utils/supabase/server";
import { ComparisonBuilder, type CampaignOption } from "@/components/ComparisonBuilder";

export const revalidate = 0;

async function getAllCampaigns(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, brand_id, brands(id, name, logo_url)")
    .order("name", { ascending: true });

  return ((data ?? []) as unknown as CampaignOption[]).sort((a, b) => {
    const ba = a.brands?.name ?? "";
    const bb = b.brands?.name ?? "";
    return ba.localeCompare(bb) || a.name.localeCompare(b.name);
  });
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

  const allCampaigns = await getAllCampaigns(supabase);

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
