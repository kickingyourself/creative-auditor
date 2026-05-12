/**
 * app/campaigns/[id]/page.tsx
 *
 * Campaign detail dashboard.
 * - Header: brand logo + name, campaign name (title)
 * - Hero: first "landing_page" creative thumbnail, or first YouTube if none
 * - Channel sections: YouTube → Meta → TikTok → Pinterest →
 *   Programmatic → OOH → TVC
 *   Sections with creatives appear first (in priority order).
 *   Empty sections are always last, greyed out.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServerClient } from "@/utils/supabase/server";
import { Creative } from "@/types";
import { CampaignChannelSections } from "@/components/CampaignChannelSections";

export const revalidate = 60;

// ── Channel taxonomy (display order for filled channels) ─────────────────────

const CHANNELS: { key: string; label: string; platforms: string[] }[] = [
  { key: "landing_page", label: "Landing Page", platforms: ["landing_page", "homepage"] },
  { key: "youtube",      label: "YouTube",      platforms: ["youtube"] },
  { key: "meta",         label: "Meta",         platforms: ["meta", "social"] },
  { key: "tiktok",       label: "TikTok",       platforms: ["tiktok"] },
  { key: "pinterest",    label: "Pinterest",    platforms: ["pinterest"] },
  { key: "programmatic", label: "Programmatic", platforms: ["programmatic", "display", "banner"] },
  { key: "ooh",          label: "OOH",          platforms: ["ooh", "outdoor"] },
  { key: "tvc",          label: "TVC",          platforms: ["tv", "tvc", "television"] },
];

// ── DB row type ───────────────────────────────────────────────────────────────

interface CreativeRow {
  id: string;
  brand_id: string;
  campaign_id: string | null;
  platform: string;
  source_url: string;
  title: string | null;
  thumbnail_url: string | null;
  view_count: number | null;
  engagement_rate: number | null;
  created_at: string;
  brands: { name: string; logo_url: string | null } | null;
  campaigns: { id: string; name: string } | null;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function toCreative(row: CreativeRow): { creative: Creative; brandLogoUrl: string | null } {
  // Normalise legacy 'homepage' rows (pre-migration) to 'landing_page'
  const rawPlatform = row.platform === "homepage" ? "landing_page" : row.platform;
  const platform    = rawPlatform as Creative["platform"];
  const brandName   = row.brands?.name ?? null;
  const brandLogoUrl = row.brands?.logo_url ?? null;

  let derivedTitle = row.source_url;
  try {
    const url = new URL(row.source_url);
    if (rawPlatform === "youtube") {
      const id = url.searchParams.get("v") ?? url.pathname.split("/").pop();
      derivedTitle = `${brandName ?? "YouTube"} · ${id}`;
    } else if (rawPlatform === "landing_page") {
      derivedTitle = `${brandName ?? url.hostname} — Landing Page`;
    } else if (rawPlatform === "tiktok") {
      derivedTitle = `${brandName ?? "TikTok"} · ${url.pathname.split("/").pop()}`;
    } else {
      derivedTitle = url.hostname.replace(/^www\./, "");
    }
  } catch { /* keep source_url */ }

  return {
    creative: {
      id:               row.id,
      brand_id:         row.brand_id,
      campaign_id:      row.campaign_id,
      campaign_name:    row.campaigns?.name ?? null,
      brand_name:       brandName,
      title:            row.title ?? derivedTitle,
      platform,
      source_url:       row.source_url,
      thumbnail_url:    row.thumbnail_url,
      video_url:        rawPlatform === "youtube" ? row.source_url : null,
      views:            row.view_count,
      likes:            null,
      comments:         null,
      engagement_rate:  row.engagement_rate,
      duration_seconds: null,
      published_at:     row.created_at,
      ad_type:          rawPlatform === "landing_page" || rawPlatform === "pinterest" ? "image" : "video",
      status:           "active",
      created_at:       row.created_at,
      updated_at:       row.created_at,
    },
    brandLogoUrl,
  };
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from("campaigns")
    .select("name, brands(name)")
    .eq("id", id)
    .single();
  const camp   = data as { name: string; brands: { name: string } | null } | null;
  const title  = camp ? `${camp.name} — ${camp.brands?.name ?? "Campaign"}` : "Campaign";
  return { title: `${title} | Creative Audit` };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CampaignPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // 1. Campaign + brand info
  const { data: campaignData, error: campErr } = await supabase
    .from("campaigns")
    .select("id, name, brands(id, name, logo_url)")
    .eq("id", id)
    .single();

  if (campErr || !campaignData) notFound();

  const campaign = campaignData as {
    id: string; name: string;
    brands: { id: string; name: string; logo_url: string | null } | null;
  };

  // Query hero_creative_id separately — resilient to the column not existing yet
  // (migration: ALTER TABLE campaigns ADD COLUMN hero_creative_id uuid REFERENCES creatives(id) ON DELETE SET NULL)
  let heroCreativeId: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: heroData } = await (supabase.from("campaigns") as any)
      .select("hero_creative_id")
      .eq("id", id)
      .single();
    heroCreativeId = (heroData as { hero_creative_id: string | null } | null)?.hero_creative_id ?? null;
  } catch { /* column not yet migrated — default to null */ }

  // 2. All creatives for this campaign
  const { data: rows, error: rowErr } = await supabase
    .from("creatives")
    .select("id, brand_id, campaign_id, platform, source_url, title, thumbnail_url, view_count, engagement_rate, created_at, brands(name, logo_url), campaigns(id, name)")
    .eq("campaign_id", id)
    .order("created_at", { ascending: false });
  if (rowErr) {
    return (
      <div style={{ padding: "28px" }}>
        <p style={{ color: "#f43f5e" }}>Error loading creatives: {rowErr.message}</p>
      </div>
    );
  }

  const allCreatives = (rows as CreativeRow[]).map(toCreative);

  // 3. Group creatives by channel key
  function getChannelKey(platform: string): string {
    for (const ch of CHANNELS) {
      if (ch.platforms.includes(platform)) return ch.key;
    }
    return "other";
  }

  const byChannel: Record<string, typeof allCreatives> = {};
  for (const item of allCreatives) {
    const key = getChannelKey(item.creative.platform);
    (byChannel[key] ??= []).push(item);
  }

  const filledChannels = CHANNELS
    .filter(ch => (byChannel[ch.key]?.length ?? 0) > 0)
    .map(ch => ({ key: ch.key, label: ch.label, items: byChannel[ch.key] }));

  const emptyChannelLabels = CHANNELS
    .filter(ch => (byChannel[ch.key]?.length ?? 0) === 0)
    .map(ch => ch.label);

  const brand = campaign.brands;

  return (
    <div style={{ padding: "28px 28px 80px", maxWidth: 1200, margin: "0 auto" }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "32px" }}>
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          {brand?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logo_url}
              alt={brand.name}
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain" }}
            />
          ) : (
            <div style={{
              width: 28, height: 28, borderRadius: 6, flexShrink: 0,
              background: "var(--color-accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 800, color: "#0a1a1b",
            }}>
              {brand?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <span style={{
            fontSize: "13px", fontWeight: 600,
            color: "var(--color-text-secondary)",
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>
            {brand?.name ?? "Unknown Brand"}
          </span>
        </div>

        {/* Campaign title */}
        <h1 style={{
          fontSize: "32px", fontWeight: 700,
          color: "var(--color-text-primary)",
          letterSpacing: "-0.03em", lineHeight: 1.1,
          marginBottom: "6px",
        }}>
          {campaign.name}
        </h1>
        <p style={{ fontSize: "14px", color: "var(--color-text-muted)" }}>
          {allCreatives.length} creative{allCreatives.length !== 1 ? "s" : ""}
        </p>
      </div>


      {/* ── Channel sections + hero banner (client component) ───────────── */}
      {allCreatives.length === 0 ? (
        <div style={{
          padding: "60px 24px", textAlign: "center",
          border: "1px dashed var(--color-border)", borderRadius: "16px",
        }}>
          <p style={{ fontSize: "15px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "8px" }}>
            No creatives yet
          </p>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
            Upload creatives and assign them to the <strong>{campaign.name}</strong> campaign.
          </p>
        </div>
      ) : (
        <CampaignChannelSections
          filledChannels={filledChannels}
          emptyChannelLabels={emptyChannelLabels}
          allCreatives={allCreatives}
          campaignId={id}
          campaignName={campaign.name}
          brandId={brand?.id ?? ""}
          brandName={brand?.name ?? ""}
          brandLogoUrl={brand?.logo_url ?? null}
          initialHeroCreativeId={heroCreativeId}
        />
      )}
    </div>
  );
}
