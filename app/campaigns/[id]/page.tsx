"use client";

/**
 * app/campaigns/[id]/page.tsx
 * Unified campaign builder + viewer.
 * - Editable header (brand, name, start date)
 * - Live creative grid fetched from /api/campaigns/[id]/creatives
 * - "Add creative" tiles per channel that open the appropriate modal
 * - Polling every 10s so new uploads appear automatically
 */

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import {
  Layers, ChevronRight, Globe, PlayCircle, LayoutGrid, Music2,
  Image, Monitor, MapPin, Tv2, Plus, Pencil, Check, X,
  Loader2, AlertCircle, CheckCircle2, RefreshCw,
} from "lucide-react";
import { LandingPageModal }  from "@/components/LandingPageModal";
import { YouTubeModal }      from "@/components/YouTubeModal";
import { ChannelModal, type ChannelConfig } from "@/components/ChannelModal";
import { PinterestModal }    from "@/components/PinterestModal";
import type { Creative } from "@/types";

// ── Channel config ────────────────────────────────────────────────────────────

const CHANNELS = [
  { key: "landing_page", label: "Landing Page",  icon: Globe,      description: "Brand homepage or campaign landing URL",       slots: 1 },
  { key: "youtube",      label: "YouTube",        icon: PlayCircle, description: "Long-form video ads and pre-rolls",            slots: 3 },
  { key: "meta",         label: "Meta",           icon: LayoutGrid, description: "Facebook & Instagram feed, stories and reels", slots: 4 },
  { key: "tiktok",       label: "TikTok",         icon: Music2,     description: "Short-form vertical video",                    slots: 3 },
  { key: "pinterest",    label: "Pinterest",      icon: Image,      description: "Pins, promoted video and collections",         slots: 3 },
  { key: "programmatic", label: "Programmatic",   icon: Monitor,    description: "Display banners and native placements",        slots: 4 },
  { key: "ooh",          label: "OOH",            icon: MapPin,     description: "Out-of-home, DOOH and transit",                slots: 2 },
  { key: "tvc",          label: "TVC",            icon: Tv2,        description: "Television commercials and broadcast",         slots: 2 },
];

const INTERACTIVE = new Set(["landing_page","youtube","meta","tiktok","pinterest"]);

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChannelItem { creative: Creative; brandLogoUrl: string | null; }
interface ChannelGroup { key: string; label: string; items: ChannelItem[]; }

interface CampaignData {
  id: string; name: string; start_date?: string | null;
  brand: { id: string; name: string; logo_url: string | null } | null;
}

// ── Editable header ───────────────────────────────────────────────────────────

function EditableHeader({ campaign, onSaved }: {
  campaign: CampaignData;
  onSaved: (updated: Partial<CampaignData>) => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(campaign.name);
  const [startDate, setStartDate] = useState(campaign.start_date ?? "");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {brand?.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={brand.logo_url} alt="" style={{ width: 22, height: 22, borderRadius: 5, objectFit: "cover" }} />
          : <div style={{ width: 22, height: 22, borderRadius: 5, background: "var(--color-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#0a1a1b" }}>{brand?.name?.[0]?.toUpperCase() ?? "?"}</div>
        }
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{brand?.name ?? "Unknown Brand"}</span>
      </div>

      {/* Name + controls */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text-primary)", background: "transparent", border: "none", borderBottom: "2px solid var(--color-accent)", outline: "none", width: "100%", padding: "2px 0 8px" }} />
          ) : (
            <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--color-text-primary)", lineHeight: 1.1 }}>{campaign.name}</h1>
          )}
          {editing && (
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>Start Date</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-primary)", fontSize: 12, outline: "none" }} />
            </div>
          )}
          {error && <p style={{ fontSize: 12, color: "#f43f5e", marginTop: 8 }}>{error}</p>}
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0, paddingTop: 4 }}>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setName(campaign.name); setStartDate(campaign.start_date ?? ""); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <X size={12} /> Cancel
              </button>
              <button onClick={handleSave} disabled={!name.trim() || saving} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7, border: "none", background: name.trim() && !saving ? "linear-gradient(135deg, var(--color-accent),#22d3a0)" : "var(--color-surface-2)", color: name.trim() && !saving ? "#fff" : "var(--color-text-muted)", fontSize: 12, fontWeight: 700, cursor: name.trim() && !saving ? "pointer" : "not-allowed", transition: "all 200ms" }}>
                {saving ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Check size={12} /> Save</>}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
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

// ── Creative card ─────────────────────────────────────────────────────────────

function CreativeCard({ item }: { item: ChannelItem }) {
  const c = item.creative;
  const thumb = c.thumbnail_url ?? item.brandLogoUrl;
  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ aspectRatio: c.platform === "landing_page" || c.platform === "pinterest" ? "4/3" : "16/9", background: "var(--color-border)", position: "relative", overflow: "hidden" }}>
        {thumb
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumb} alt={c.title ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 11 }}>No preview</div>
        }
      </div>
      <div style={{ padding: "10px 12px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.title ?? ""}>{c.title ?? c.source_url}</p>
        {c.views != null && <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 3 }}>{(c.views / 1000).toFixed(0)}K views</p>}
      </div>
    </div>
  );
}

// ── Add tile ──────────────────────────────────────────────────────────────────

function AddTile({ onClick, tall }: { onClick: () => void; tall?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", minHeight: tall ? 240 : 160, border: `1.5px dashed ${hovered ? "var(--color-accent)" : "var(--color-border)"}`, borderRadius: 12, background: hovered ? "rgba(79,179,186,0.04)" : "transparent", cursor: "pointer", transition: "all 200ms", outline: "none" }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", border: `1.5px dashed ${hovered ? "rgba(79,179,186,0.6)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Plus size={18} strokeWidth={1.8} color={hovered ? "var(--color-accent)" : "rgba(255,255,255,0.2)"} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: hovered ? "var(--color-accent)" : "rgba(255,255,255,0.18)", transition: "color 200ms" }}>Add creative</span>
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CampaignBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [campaign, setCampaign]   = useState<CampaignData | null>(null);
  const [channels, setChannels]   = useState<ChannelGroup[]>([]);
  const [allItems, setAllItems]   = useState<ChannelItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);

  // Modal state
  const [modalOpen,     setModalOpen]     = useState(false);
  const [ytOpen,        setYtOpen]        = useState(false);
  const [metaOpen,      setMetaOpen]      = useState(false);
  const [tiktokOpen,    setTiktokOpen]    = useState(false);
  const [pinterestOpen, setPinterestOpen] = useState(false);

  const META_CONFIG: ChannelConfig   = { platform: "meta",   label: "Meta",   icon: <LayoutGrid size={14} color="#1877f2" />, accentColor: "#1877f2", accentBg: "rgba(24,119,242,0.10)" };
  const TIKTOK_CONFIG: ChannelConfig = { platform: "tiktok", label: "TikTok", icon: <Music2    size={14} color="#ff0050" />, accentColor: "#ff0050", accentBg: "rgba(255,0,80,0.10)"   };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}/creatives`);
      if (!res.ok) { setFetchError("Failed to load campaign"); return; }
      const data = await res.json();
      setCampaign(data.campaign);
      setChannels(data.channels ?? []);
      // build flat list for CampaignChannelSections hero picker
      const flat: ChannelItem[] = (data.channels ?? []).flatMap((ch: ChannelGroup) => ch.items);
      setAllItems(flat);
      setFetchError(null);
    } catch { setFetchError("Network error"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData, lastRefresh]);

  // Poll every 10s so uploads appear automatically
  useEffect(() => {
    const t = setInterval(() => setLastRefresh(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  function onModalSuccess() { setLastRefresh(Date.now()); }

  // Build per-channel creative map
  const byChannel: Record<string, ChannelItem[]> = {};
  for (const ch of channels) byChannel[ch.key] = ch.items;

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

  // Hero = first landing_page, then youtube, then any
  const heroItem = allItems.find(i => i.creative.platform === "landing_page")
                ?? allItems.find(i => i.creative.platform === "youtube")
                ?? allItems[0] ?? null;

  return (
    <div style={{ padding: "28px 28px 80px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        <Link href="/campaigns" style={{ fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
          <Layers size={13} color="var(--color-accent)" /> Campaigns
        </Link>
        <ChevronRight size={13} color="var(--color-text-muted)" />
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>{campaign.name}</span>
        <button onClick={() => setLastRefresh(Date.now())} title="Refresh" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Editable header */}
      <EditableHeader campaign={campaign} onSaved={upd => setCampaign(c => c ? { ...c, ...upd } : c)} />

      {/* Hero section */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", padding: "3px 10px", borderRadius: 20 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(251,191,36,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Hero Creative</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
            {heroItem ? "Pinned from your creatives below" : "Add a creative below to set your hero"}
          </span>
        </div>
        {heroItem ? (
          <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid var(--color-border)", background: "var(--color-surface-2)", display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 260 }}>
            <div style={{ background: "var(--color-border)", overflow: "hidden" }}>
              {heroItem.creative.thumbnail_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={heroItem.creative.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{ width: "100%", height: "100%", minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 12 }}>No preview</div>
              }
            </div>
            <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{heroItem.creative.platform.replace("_"," ")}</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", lineHeight: 1.3 }}>{heroItem.creative.title ?? heroItem.creative.source_url}</p>
              {heroItem.creative.views != null && <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{(heroItem.creative.views/1000).toFixed(0)}K views</p>}
            </div>
          </div>
        ) : (
          <div style={{ width: "100%", height: 220, borderRadius: 16, border: "1.5px dashed rgba(251,191,36,0.2)", background: "rgba(251,191,36,0.02)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(251,191,36,0.3)" }}>No hero selected</p>
            <p style={{ fontSize: 12, color: "var(--color-text-muted)", maxWidth: 280, textAlign: "center", lineHeight: 1.5 }}>Add a creative below, then it will appear here automatically</p>
          </div>
        )}
      </div>

      {/* Channel sections — builder tiles */}
      {allItems.length === 0 && (
        <div style={{ marginBottom: 28, padding: "14px 18px", background: "rgba(79,179,186,0.06)", border: "1px solid rgba(79,179,186,0.15)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={13} color="var(--color-accent)" />
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>Campaign created — click any <strong>Add creative</strong> tile below to start building</span>
        </div>
      )}

      {CHANNELS.map(ch => {
        const Icon      = ch.icon;
        const items     = byChannel[ch.key] ?? [];
        const isLP      = ch.key === "landing_page";
        const isInteractive = INTERACTIVE.has(ch.key);
        const openModal = ch.key === "landing_page"  ? () => setModalOpen(true)
                        : ch.key === "youtube"       ? () => setYtOpen(true)
                        : ch.key === "meta"          ? () => setMetaOpen(true)
                        : ch.key === "tiktok"        ? () => setTiktokOpen(true)
                        : ch.key === "pinterest"     ? () => setPinterestOpen(true)
                        : undefined;

        // Slots = existing items + one "add" tile (always show add tile if interactive)
        const addSlots = isInteractive ? 1 : 0;

        return (
          <section key={ch.key} style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(79,179,186,0.08)", border: "1px solid rgba(79,179,186,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={13} color="var(--color-accent)" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em" }}>{ch.label}</h2>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{ch.description}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", padding: "2px 8px", borderRadius: 20 }}>{items.length}</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isLP ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
              {items.map(item => <CreativeCard key={item.creative.id} item={item} />)}
              {addSlots > 0 && openModal && <AddTile onClick={openModal} tall={isLP} />}
              {!isInteractive && items.length === 0 && (
                <div style={{ gridColumn: "1/-1", padding: "16px 20px", border: "1px dashed var(--color-border)", borderRadius: 10, textAlign: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Coming soon — manual upload via the Creatives page</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 24, height: 1, background: "var(--color-border)", opacity: 0.35 }} />
          </section>
        );
      })}

      {/* Modals */}
      {modalOpen     && <LandingPageModal brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setModalOpen(false)}     onSuccess={() => { setModalOpen(false);     onModalSuccess(); }} />}
      {ytOpen        && <YouTubeModal     brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setYtOpen(false)}        onSuccess={() => { setYtOpen(false);        onModalSuccess(); }} />}
      {metaOpen      && <ChannelModal     config={META_CONFIG}   brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setMetaOpen(false)}      onSuccess={() => { setMetaOpen(false);      onModalSuccess(); }} />}
      {tiktokOpen    && <ChannelModal     config={TIKTOK_CONFIG} brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setTiktokOpen(false)}    onSuccess={() => { setTiktokOpen(false);    onModalSuccess(); }} />}
      {pinterestOpen && <PinterestModal   brandId={brandId} brandName={brandName} campaignId={id} onClose={() => setPinterestOpen(false)} onSuccess={() => { setPinterestOpen(false); onModalSuccess(); }} />}
    </div>
  );
}
