"use client";

/**
 * app/campaigns/[id]/page.tsx
 *
 * Unified campaign builder + viewer.
 * Layout: Campaign info → Hero → Landing Page → YouTube → Meta → TikTok → Pinterest → …
 */

import { useState, useEffect, useCallback, useMemo, use } from "react";
import Link from "next/link";
import {
  Layers, ChevronRight, Pencil, Check, X, Loader2, AlertCircle, RefreshCw, LayoutGrid, Music2,
} from "lucide-react";
import { LandingPageModal }    from "@/components/LandingPageModal";
import { YouTubeModal }        from "@/components/YouTubeModal";
import { ChannelModal, type ChannelConfig } from "@/components/ChannelModal";
import { PinterestModal }      from "@/components/PinterestModal";
import { ProgrammaticModal }   from "@/components/ProgrammaticModal";
import { CampaignChannelSections } from "@/components/CampaignChannelSections";
import { ChannelGapDials }          from "@/components/ChannelGapDials";
import type { Creative } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChannelItem { creative: Creative; brandLogoUrl: string | null; }
interface ChannelGroup { key: string; label: string; items: ChannelItem[]; }
interface CampaignData {
  id: string; name: string; start_date?: string | null;
  hero_creative_id?: string | null;
  brand: { id: string; name: string; logo_url: string | null } | null;
}

// ── Editable header ───────────────────────────────────────────────────────────

function EditableHeader({ campaign, onSaved }: {
  campaign: CampaignData;
  onSaved: (upd: Partial<CampaignData>) => void;
}) {
  const [editing, setEditing]     = useState(false);
  const [name, setName]           = useState(campaign.name);
  const [startDate, setStartDate] = useState(campaign.start_date ?? "");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSave() {
    setError(null); setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), start_date: startDate || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      onSaved({ name: name.trim(), start_date: startDate || null });
      setEditing(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  const brand = campaign.brand;

  return (
    <div style={{ marginBottom: 32 }}>
      {/* Brand row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {brand?.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={brand.logo_url} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: "cover" }} />
          : <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#0a1a1b" }}>{brand?.name?.[0]?.toUpperCase() ?? "?"}</div>
        }
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{brand?.name ?? "Unknown Brand"}</span>
      </div>

      {/* Name + controls row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
              style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--color-accent)", outline: "none", width: "100%", padding: "2px 0 8px" }} />
          ) : (
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text-primary)", lineHeight: 1.1 }}>{campaign.name}</h1>
          )}
          {editing && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Start Date</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-primary)", fontSize: 12, outline: "none" }} />
            </div>
          )}
          {error && <p style={{ fontSize: 12, color: "#f43f5e", marginTop: 6 }}>{error}</p>}
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0, paddingTop: 4 }}>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setName(campaign.name); setStartDate(campaign.start_date ?? ""); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <X size={12} /> Cancel
              </button>
              <button onClick={handleSave} disabled={!name.trim() || saving}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7, border: "none", background: name.trim() && !saving ? "linear-gradient(135deg, var(--color-accent),#22d3a0)" : "var(--color-surface-2)", color: name.trim() && !saving ? "#fff" : "var(--color-text-muted)", fontSize: 12, fontWeight: 700, cursor: name.trim() && !saving ? "pointer" : "not-allowed", transition: "all 200ms" }}>
                {saving ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Check size={12} /> Save</>}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Pencil size={11} /> Edit
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, height: 1, background: "var(--color-border)", opacity: 0.5 }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [campaign, setCampaign]     = useState<CampaignData | null>(null);
  const [channels, setChannels]     = useState<ChannelGroup[]>([]);
  const [allItems, setAllItems]     = useState<ChannelItem[]>([]);
  const [heroCreativeId, setHeroCreativeId] = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [tick, setTick]             = useState(0);

  // Modals
  const [modalOpen,         setModalOpen]         = useState(false);
  const [ytOpen,            setYtOpen]            = useState(false);
  const [metaOpen,          setMetaOpen]          = useState(false);
  const [tiktokOpen,        setTiktokOpen]        = useState(false);
  const [pinterestOpen,     setPinterestOpen]     = useState(false);
  const [programmaticOpen,  setProgrammaticOpen]  = useState(false);

  const META_CONFIG: ChannelConfig   = { platform: "meta",   label: "Meta",   icon: <LayoutGrid size={14} color="#1877f2" />, accentColor: "#1877f2", accentBg: "rgba(24,119,242,0.10)" };
  const TIKTOK_CONFIG: ChannelConfig = { platform: "tiktok", label: "TikTok", icon: <Music2    size={14} color="#ff0050" />, accentColor: "#ff0050", accentBg: "rgba(255,0,80,0.10)"   };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}/creatives`);
      if (!res.ok) { setFetchError("Failed to load campaign"); return; }
      const data = await res.json();
      setCampaign(data.campaign);
      setHeroCreativeId(data.campaign.hero_creative_id ?? null);
      setChannels(data.channels ?? []);
      setAllItems((data.channels ?? []).flatMap((ch: ChannelGroup) => ch.items));
      setFetchError(null);
    } catch { setFetchError("Network error"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData, tick]);

  // Poll every 10s
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  function refresh() { setTick(Date.now()); }

  // Derive platform counts from this campaign's creatives (for the gap dials).
  // Must be here — before any early returns — to satisfy Rules of Hooks.
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const { creative } of allItems) {
      const raw = creative.platform as string;
      const p = raw === "homepage" ? "landing_page" : raw;
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  }, [allItems]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 10 }}>
      <Loader2 size={18} style={{ animation: "spin 1s linear infinite", color: "var(--color-accent)" }} />
      <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Loading campaign…</span>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (fetchError || !campaign) return (
    <div style={{ padding: 28 }}>
      <div style={{ display: "flex", gap: 8, padding: 14, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10 }}>
        <AlertCircle size={14} color="#f43f5e" />
        <p style={{ fontSize: 13, color: "#f43f5e" }}>{fetchError ?? "Campaign not found"}</p>
      </div>
    </div>
  );

  const brandId   = campaign.brand?.id   ?? "";
  const brandName = campaign.brand?.name ?? "";

  const filledChannels  = channels.map(ch => ({ key: ch.key, label: ch.label, items: ch.items }));
  const CHANNEL_ORDER   = ["landing_page","youtube","meta","tiktok","pinterest","programmatic","ooh","tvc"];
  const filledKeys      = new Set(filledChannels.map(c => c.key));
  const emptyChannelLabels = CHANNEL_ORDER
    .filter(k => !filledKeys.has(k))
    .map(k => k === "landing_page" ? "Landing Page" : k.charAt(0).toUpperCase() + k.slice(1));

  // Per-channel add handlers passed into CampaignChannelSections
  const onAddCreative: Record<string, () => void> = {
    landing_page:  () => setModalOpen(true),
    youtube:       () => setYtOpen(true),
    meta:          () => setMetaOpen(true),
    tiktok:        () => setTiktokOpen(true),
    pinterest:     () => setPinterestOpen(true),
    programmatic:  () => setProgrammaticOpen(true),
  };

  function onSuccess() { setTick(Date.now()); }

  return (
    <div style={{ padding: "28px 28px 80px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        <Link href="/campaigns" style={{ fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
          <Layers size={13} color="var(--color-accent)" /> Campaigns
        </Link>
        <ChevronRight size={13} color="var(--color-text-muted)" />
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>{campaign.name}</span>
        <button onClick={refresh} title="Refresh" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* 1. Campaign information */}
      <EditableHeader campaign={campaign} onSaved={upd => setCampaign(c => c ? { ...c, ...upd } : c)} />

      {/* 2. Channel gap analysis */}
      <ChannelGapDials platformCounts={platformCounts} />

      {/* 3. Hero → Landing Page → YouTube → Meta → … */}
      {allItems.length === 0 ? (
        <div style={{ padding: "14px 18px", background: "rgba(79,179,186,0.06)", border: "1px solid rgba(79,179,186,0.15)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Campaign created — click a channel below to start adding creatives</span>
        </div>
      ) : null}

      <CampaignChannelSections
        filledChannels={filledChannels}
        emptyChannelLabels={emptyChannelLabels}
        allCreatives={allItems}
        campaignId={id}
        campaignName={campaign.name}
        brandId={brandId}
        brandName={brandName}
        brandLogoUrl={campaign.brand?.logo_url ?? null}
        initialHeroCreativeId={heroCreativeId}
        onAddCreative={onAddCreative}
      />

      {/* Modals */}
      {modalOpen          && <LandingPageModal  brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setModalOpen(false)}          onSuccess={() => { setModalOpen(false);          onSuccess(); }} />}
      {ytOpen             && <YouTubeModal      brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setYtOpen(false)}             onSuccess={() => { setYtOpen(false);             onSuccess(); }} />}
      {metaOpen           && <ChannelModal      config={META_CONFIG}   brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setMetaOpen(false)}           onSuccess={() => { setMetaOpen(false);           onSuccess(); }} />}
      {tiktokOpen         && <ChannelModal      config={TIKTOK_CONFIG} brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setTiktokOpen(false)}         onSuccess={() => { setTiktokOpen(false);         onSuccess(); }} />}
      {pinterestOpen      && <PinterestModal    brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setPinterestOpen(false)}      onSuccess={() => { setPinterestOpen(false);      onSuccess(); }} />}
      {programmaticOpen   && <ProgrammaticModal brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setProgrammaticOpen(false)}   onSuccess={() => { setProgrammaticOpen(false);   onSuccess(); }} />}
    </div>
  );
}
