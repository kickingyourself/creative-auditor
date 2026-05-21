/**
 * app/api/search/route.ts
 *
 * GET /api/search?q=<query>
 *
 * Full-text search across:
 *   - creatives  (title, platform, ad_type, brand_name, campaign_name, source_url)
 *   - campaigns  (name, brand name, start_date, end_date)
 *   - brands     (name, website_url)
 *   - competitive_snapshots (name)
 *
 * Returns up to 5 results per category, grouped.
 */

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface SearchResult {
  id: string;
  type: "creative" | "campaign" | "brand" | "snapshot";
  title: string;
  subtitle: string;
  thumbnail_url?: string | null;
  href: string;
  meta?: string; // e.g. platform badge, creative count
}

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return Response.json({ results: [] });
  }

  const supabase = getSupabase();
  const pattern = `%${q}%`;

  const [creativesRes, campaignsRes, brandsRes, snapshotsRes] = await Promise.all([
    // Creatives — search title, platform, ad_type, source_url
    supabase
      .from("creatives")
      .select("id, title, platform, ad_type, thumbnail_url, source_url, brand_id, campaign_id, brands(name), campaigns!campaign_id(name)")
      .or(`title.ilike.${pattern},platform.ilike.${pattern},ad_type.ilike.${pattern},source_url.ilike.${pattern}`)
      .limit(6),

    // Campaigns — search name
    supabase
      .from("campaigns")
      .select("id, name, start_date, end_date, brands(name, logo_url)")
      .ilike("name", pattern)
      .limit(5),

    // Brands — search name, website_url
    supabase
      .from("brands")
      .select("id, name, logo_url, website_url")
      .or(`name.ilike.${pattern},website_url.ilike.${pattern}`)
      .limit(4),

    // Competitive snapshots — search name
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("competitive_snapshots") as any)
      .select("id, name, created_at")
      .ilike("name", pattern)
      .limit(4),
  ]);

  const results: SearchResult[] = [];

  // ── Brands ────────────────────────────────────────────────────────────────
  for (const b of (brandsRes.data ?? []) as {
    id: string; name: string; logo_url: string | null; website_url: string | null;
  }[]) {
    results.push({
      id: b.id,
      type: "brand",
      title: b.name,
      subtitle: b.website_url ?? "Brand",
      thumbnail_url: b.logo_url,
      href: `/brands/${b.id}`,
      meta: "Brand",
    });
  }

  // ── Campaigns ─────────────────────────────────────────────────────────────
  for (const c of (campaignsRes.data ?? []) as unknown as {
    id: string; name: string; start_date: string | null; end_date: string | null;
    brands: { name: string; logo_url: string | null } | null;
  }[]) {
    results.push({
      id: c.id,
      type: "campaign",
      title: c.name,
      subtitle: c.brands?.name ?? "Campaign",
      href: `/campaigns/${c.id}`,
      meta: "Campaign",
    });
  }

  // ── Creatives ─────────────────────────────────────────────────────────────
  for (const cr of (creativesRes.data ?? []) as unknown as {
    id: string; title: string | null; platform: string; ad_type: string;
    thumbnail_url: string | null; source_url: string;
    brands: { name: string } | null;
    campaigns: { name: string } | null;
  }[]) {
    const displayTitle = cr.title ?? cr.source_url;
    const sub = [cr.brands?.name, cr.campaigns?.name].filter(Boolean).join(" · ");
    results.push({
      id: cr.id,
      type: "creative",
      title: displayTitle,
      subtitle: sub || cr.platform,
      thumbnail_url: cr.thumbnail_url,
      href: `/creatives?highlight=${cr.id}`,
      meta: cr.platform,
    });
  }

  // ── Competitive snapshots ─────────────────────────────────────────────────
  for (const s of (snapshotsRes.data ?? []) as {
    id: string; name: string; created_at: string;
  }[]) {
    results.push({
      id: s.id,
      type: "snapshot",
      title: s.name,
      subtitle: `Saved ${new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      href: `/competitive/${s.id}`,
      meta: "Comparison",
    });
  }

  return Response.json({ results });
}
