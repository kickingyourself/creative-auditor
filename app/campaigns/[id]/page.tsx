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
import { CreativeGrid } from "@/components/CreativeGrid";
import { AddCreativeTile } from "@/components/AddCreativeTile";

export const revalidate = 60;

// ── Channel taxonomy (display order for filled channels) ─────────────────────

const CHANNELS: { key: string; label: string; platforms: string[] }[] = [
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
      ad_type:          rawPlatform === "landing_page" ? "image" : "video",
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

  // 3. Hero: prefer landing_page, fall back to YouTube
  const hero =
    allCreatives.find(c => c.creative.platform === "landing_page") ??
    allCreatives.find(c => c.creative.platform === "youtube") ??
    null;

  // 4. Non-landing-page creatives for channel sections
  const channelCreatives = allCreatives.filter(c => c.creative.platform !== "landing_page");

  // 5. Group creatives by channel key
  function getChannelKey(platform: string): string {
    for (const ch of CHANNELS) {
      if (ch.platforms.includes(platform)) return ch.key;
    }
    return "other";
  }

  const byChannel: Record<string, typeof allCreatives> = {};
  for (const item of channelCreatives) {
    const key = getChannelKey(item.creative.platform);
    (byChannel[key] ??= []).push(item);
  }

  // 6. Sort channels: filled first (in CHANNELS order), empty last
  const filledChannels   = CHANNELS.filter(ch => (byChannel[ch.key]?.length ?? 0) > 0);
  const emptyChannels    = CHANNELS.filter(ch => (byChannel[ch.key]?.length ?? 0) === 0);

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
          {allCreatives.length} creative{allCreatives.length !== 1 ? "s" : ""} across {filledChannels.length} channel{filledChannels.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {hero && (
        <div style={{ marginBottom: "40px" }}>
          <div style={{
            borderRadius: "16px",
            overflow: "hidden",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            aspectRatio: hero.creative.platform === "landing_page" ? "16/7" : "16/9",
            position: "relative",
          }}>
            {hero.creative.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero.creative.thumbnail_url}
                alt={hero.creative.title ?? ""}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{
                width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--color-text-muted)", fontSize: "14px",
              }}>
                No preview available
              </div>
            )}
            {/* Platform badge */}
            <span style={{
              position: "absolute", top: 14, right: 14,
              fontSize: "10px", fontWeight: 700,
              background: "rgba(0,0,0,0.6)", color: "#fff",
              backdropFilter: "blur(8px)",
              padding: "4px 10px", borderRadius: "20px",
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              {hero.creative.platform === "landing_page" ? "Landing Page" : "YouTube"}
            </span>
          </div>
          {hero.creative.title && (
            <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "10px" }}>
              {hero.creative.title}
            </p>
          )}
        </div>
      )}

      {/* ── Filled channel sections ───────────────────────────────────────── */}
      {filledChannels.map(ch => (
        <section key={ch.key} style={{ marginBottom: "48px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            marginBottom: "16px",
          }}>
            <h2 style={{
              fontSize: "16px", fontWeight: 700,
              color: "var(--color-text-primary)", letterSpacing: "-0.02em",
            }}>
              {ch.label}
            </h2>
            <span style={{
              fontSize: "11px", fontWeight: 600,
              color: "var(--color-accent)",
              background: "rgba(79,179,186,0.1)",
              border: "1px solid rgba(79,179,186,0.2)",
              padding: "2px 8px", borderRadius: "20px",
            }}>
              {byChannel[ch.key].length}
            </span>
          </div>
          <CreativeGrid items={byChannel[ch.key]} />
        </section>
      ))}

      {/* ── Add creative tile ─────────────────────────────────────────── */}
      {brand && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: "18px",
          marginBottom: "40px",
        }}>
          <AddCreativeTile
            brandId={brand.id}
            brandName={brand.name}
            brandLogoUrl={brand.logo_url}
            campaignId={id}
            campaignName={campaign.name}
          />
        </div>
      )}

      {/* ── Empty channel sections (greyed out, always last) ─────────────── */}
      {emptyChannels.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <p style={{
            fontSize: "10px", fontWeight: 600,
            color: "var(--color-text-muted)",
            textTransform: "uppercase", letterSpacing: "0.08em",
            marginBottom: "12px",
          }}>
            No assets loaded yet
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {emptyChannels.map(ch => (
              <div key={ch.key} style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px dashed var(--color-border)",
                fontSize: "12px", fontWeight: 500,
                color: "var(--color-text-muted)",
                opacity: 0.5,
              }}>
                {ch.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {allCreatives.length === 0 && (
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
      )}
    </div>
  );
}
