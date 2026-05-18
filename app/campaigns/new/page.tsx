"use client";

/**
 * app/campaigns/new/page.tsx
 *
 * Campaign Builder — full client component.
 *
 * Header is a live inline-editable form:
 *   Brand (searchable selector) · Campaign Name · Description · Start Date
 *   An "Edit" button toggles between read and edit mode.
 *   Saving creates/updates a campaign record in the DB.
 *
 * The right sidebar (Campaign Details card) is removed.
 * Channel creative tiles are interactive for implemented channels.
 */

import { useState, useEffect, useRef, useTransition } from "react";
import {
  Layers, ChevronRight, Plus, Globe, PlayCircle, LayoutGrid,
  Music2, Image, Monitor, MapPin, Tv2,
  Pencil, Check, X, Loader2, AlertCircle, CalendarDays, AlignLeft, Tag,
} from "lucide-react";
import Link from "next/link";
import { LandingPageModal }  from "@/components/LandingPageModal";
import { YouTubeModal }      from "@/components/YouTubeModal";
import { ChannelModal, type ChannelConfig } from "@/components/ChannelModal";
import { PinterestModal }    from "@/components/PinterestModal";

// ── Channel taxonomy ──────────────────────────────────────────────────────────

const CHANNELS: { key: string; label: string; icon: React.ElementType; description: string; slots: number }[] = [
  { key: "landing_page", label: "Landing Page",  icon: Globe,       description: "Brand homepage or campaign landing URL",      slots: 1 },
  { key: "youtube",      label: "YouTube",        icon: PlayCircle,  description: "Long-form video ads and pre-rolls",           slots: 3 },
  { key: "meta",         label: "Meta",           icon: LayoutGrid,  description: "Facebook & Instagram feed, stories and reels", slots: 4 },
  { key: "tiktok",       label: "TikTok",         icon: Music2,      description: "Short-form vertical video",                   slots: 3 },
  { key: "pinterest",    label: "Pinterest",      icon: Image,       description: "Pins, promoted video and collections",        slots: 3 },
  { key: "programmatic", label: "Programmatic",   icon: Monitor,     description: "Display banners and native placements",       slots: 4 },
  { key: "ooh",          label: "OOH",            icon: MapPin,      description: "Out-of-home, DOOH and transit",               slots: 2 },
  { key: "tvc",          label: "TVC",            icon: Tv2,         description: "Television commercials and broadcast",        slots: 2 },
];

// ── Brand selector ────────────────────────────────────────────────────────────

interface BrandOption { id: string; name: string; logo_url: string | null; }

function BrandSelector({ value, onChange, disabled }: {
  value: BrandOption | null;
  onChange: (b: BrandOption | null) => void;
  disabled?: boolean;
}) {
  const [query, setQuery]     = useState("");
  const [brands, setBrands]   = useState<BrandOption[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/brands")
      .then(r => r.json())
      .then(d => setBrands(d.brands ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = brands.filter(b => b.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 8,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface-2)",
          color: value ? "var(--color-text-primary)" : "var(--color-text-muted)",
          fontSize: 13, fontWeight: value ? 600 : 400,
          cursor: disabled ? "default" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {loading
          ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          : <Tag size={13} color="var(--color-text-muted)" />
        }
        {value?.name ?? "Select brand…"}
      </button>

      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200, width: 240, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden" }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--color-border)" }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search brands…"
              style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 12, color: "var(--color-text-primary)" }}
            />
          </div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {filtered.length === 0
              ? <p style={{ padding: "10px 12px", fontSize: 12, color: "var(--color-text-muted)" }}>No brands found</p>
              : filtered.map(b => (
                  <button key={b.id} type="button"
                    onClick={() => { onChange(b); setOpen(false); setQuery(""); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: value?.id === b.id ? "rgba(79,179,186,0.08)" : "transparent", border: "none", cursor: "pointer", color: "var(--color-text-primary)", fontSize: 13, textAlign: "left" }}
                  >
                    {b.logo_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={b.logo_url} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: "cover" }} />
                      : <div style={{ width: 20, height: 20, borderRadius: 4, background: "var(--color-border)", flexShrink: 0 }} />
                    }
                    {b.name}
                  </button>
                ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline editable field ─────────────────────────────────────────────────────

function InlineField({ icon: Icon, label, value, onChange, placeholder, type = "text", editing }: {
  icon: React.ElementType; label: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  type?: string; editing: boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        <Icon size={11} color="var(--color-text-muted)" />
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      </div>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%", padding: "7px 10px", borderRadius: 7,
            border: "1px solid var(--color-accent)",
            background: "var(--color-surface-2)",
            color: "var(--color-text-primary)", fontSize: 13,
            outline: "none",
          }}
        />
      ) : (
        <p style={{ fontSize: 13, color: value ? "var(--color-text-primary)" : "var(--color-text-muted)", fontStyle: value ? "normal" : "italic", padding: "7px 0" }}>
          {value || placeholder}
        </p>
      )}
    </div>
  );
}

// ── Campaign header ───────────────────────────────────────────────────────────

interface CampaignMeta {
  id: string | null;
  name: string;
  description: string;
  start_date: string;
  brand: BrandOption | null;
}

function CampaignHeader({ meta, onMetaChange, onSave, saving, saveError }: {
  meta: CampaignMeta;
  onMetaChange: (m: CampaignMeta) => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
}) {
  const [editing, setEditing] = useState(true); // start in edit mode for new campaign
  const isNew = !meta.id;

  function handleSave() {
    onSave();
    setEditing(false);
  }

  function handleCancel() {
    setEditing(false);
  }

  const hasRequiredFields = !!meta.brand && !!meta.name.trim();

  return (
    <div style={{ marginBottom: 36 }}>
      {/* Brand + name row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Brand picker */}
          <div style={{ marginBottom: 12 }}>
            {editing ? (
              <BrandSelector value={meta.brand} onChange={b => onMetaChange({ ...meta, brand: b })} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {meta.brand?.logo_url &&
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={meta.brand.logo_url} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: "cover" }} />
                }
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-accent)" }}>
                  {meta.brand?.name ?? <span style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>No brand selected</span>}
                </span>
              </div>
            )}
          </div>

          {/* Campaign name */}
          {editing ? (
            <input
              type="text"
              value={meta.name}
              onChange={e => onMetaChange({ ...meta, name: e.target.value })}
              placeholder="Campaign name…"
              style={{
                fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1,
                color: "var(--color-text-primary)",
                background: "transparent", border: "none",
                borderBottom: "2px solid var(--color-accent)",
                outline: "none", width: "100%", padding: "4px 0 8px",
                marginBottom: 4,
              }}
            />
          ) : (
            <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, color: meta.name ? "var(--color-text-primary)" : "var(--color-text-muted)", marginBottom: 4, fontStyle: meta.name ? "normal" : "italic" }}>
              {meta.name || "Untitled campaign"}
            </h1>
          )}

          {/* Description + Start Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px 24px", marginTop: 14, alignItems: "start" }}>
            <InlineField icon={AlignLeft} label="Description" value={meta.description} onChange={v => onMetaChange({ ...meta, description: v })} placeholder="Optional campaign brief…" editing={editing} />
            <InlineField icon={CalendarDays} label="Start Date" value={meta.start_date} onChange={v => onMetaChange({ ...meta, start_date: v })} placeholder="YYYY-MM-DD" type="date" editing={editing} />
          </div>

          {/* Save error */}
          {saveError && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 12px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8 }}>
              <AlertCircle size={13} color="#f43f5e" />
              <span style={{ fontSize: 12, color: "#f43f5e" }}>{saveError}</span>
            </div>
          )}
        </div>

        {/* Edit / Save / Cancel controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", paddingTop: 2, flexShrink: 0 }}>
          {editing ? (
            <>
              {!isNew && (
                <button type="button" onClick={handleCancel}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  <X size={13} /> Cancel
                </button>
              )}
              <button type="button" onClick={handleSave} disabled={!hasRequiredFields || saving}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, border: "none", background: hasRequiredFields && !saving ? "linear-gradient(135deg, var(--color-accent), #22d3a0)" : "var(--color-surface-2)", color: hasRequiredFields && !saving ? "#fff" : "var(--color-text-muted)", fontSize: 12, fontWeight: 700, cursor: hasRequiredFields && !saving ? "pointer" : "not-allowed", boxShadow: hasRequiredFields ? "0 2px 8px rgba(79,179,186,0.25)" : "none", transition: "all 200ms" }}>
                {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Check size={13} /> {isNew ? "Create Campaign" : "Save Changes"}</>}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setEditing(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-secondary)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ marginTop: 20, height: 1, background: "var(--color-border)", opacity: 0.5 }} />

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Placeholder tile ──────────────────────────────────────────────────────────

function PlaceholderTile({ tall = false, onClick, interactive = false }: {
  tall?: boolean; onClick?: () => void; interactive?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button type="button" onClick={onClick} disabled={!interactive}
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", minHeight: tall ? 260 : 170, border: `1.5px dashed ${hovered ? "var(--color-accent)" : "var(--color-border)"}`, borderRadius: 14, background: hovered ? "rgba(79,179,186,0.04)" : "rgba(255,255,255,0.015)", color: hovered ? "var(--color-accent)" : "var(--color-text-muted)", cursor: interactive ? "pointer" : "default", transition: "all 200ms ease", outline: "none" }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", border: `1.5px dashed ${hovered ? "rgba(79,179,186,0.6)" : "rgba(255,255,255,0.15)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 200ms ease" }}>
        <Plus size={20} strokeWidth={1.8} color={hovered ? "var(--color-accent)" : "rgba(255,255,255,0.2)"} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", color: hovered ? "var(--color-accent)" : "rgba(255,255,255,0.18)", transition: "color 200ms ease" }}>
        Add creative
      </span>
    </button>
  );
}

// ── Hero placeholder ──────────────────────────────────────────────────────────

function HeroPlaceholder() {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", padding: "3px 10px", borderRadius: 20 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(251,191,36,0.7)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Hero Creative</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Pin your campaign&apos;s headline asset here</span>
      </div>
      <div style={{ width: "100%", height: 280, borderRadius: 18, border: "1.5px dashed rgba(251,191,36,0.25)", background: "rgba(251,191,36,0.025)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(251,191,36,0.35)", marginBottom: 4 }}>No hero selected</p>
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", maxWidth: 280, textAlign: "center", lineHeight: 1.5 }}>Upload a creative below, then pin it here as your campaign&apos;s headline asset</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  // Campaign meta state
  const [meta, setMeta] = useState<CampaignMeta>({ id: null, name: "", description: "", start_date: "", brand: null });
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition]       = useTransition();

  // Modal state
  const [modalOpen,       setModalOpen]       = useState(false);
  const [ytModalOpen,     setYtModalOpen]     = useState(false);
  const [metaOpen,        setMetaOpen]        = useState(false);
  const [tiktokOpen,      setTiktokOpen]      = useState(false);
  const [pinterestOpen,   setPinterestOpen]   = useState(false);

  const META_CONFIG: ChannelConfig = { platform: "meta",    label: "Meta",    icon: <LayoutGrid size={15} color="#1877f2" />, accentColor: "#1877f2", accentBg: "rgba(24,119,242,0.10)" };
  const TIKTOK_CONFIG: ChannelConfig = { platform: "tiktok", label: "TikTok", icon: <Music2 size={15} color="#ff0050" />,    accentColor: "#ff0050", accentBg: "rgba(255,0,80,0.10)"   };

  // ── Save / update campaign ──────────────────────────────────────────────────
  function handleSave() {
    if (!meta.brand || !meta.name.trim()) return;
    setSaveError(null);
    setSaving(true);

    startTransition(async () => {
      try {
        if (meta.id) {
          // PATCH existing
          const res = await fetch(`/api/campaigns/${meta.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: meta.name.trim(), description: meta.description || null, start_date: meta.start_date || null }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message ?? "Update failed");
          setMeta(m => ({ ...m, id: data.campaign.id }));
        } else {
          // POST new
          const res = await fetch("/api/campaigns", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brand_id: meta.brand.id, name: meta.name.trim(), description: meta.description || null, start_date: meta.start_date || null }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message ?? "Create failed");
          setMeta(m => ({ ...m, id: data.campaign.id }));
        }
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setSaving(false);
      }
    });
  }

  const brandId    = meta.brand?.id    ?? "";
  const brandName  = meta.brand?.name  ?? "";
  const campaignId = meta.id;

  return (
    <div style={{ padding: "28px 28px 80px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
        <Link href="/campaigns" style={{ fontSize: 13, color: "var(--color-text-muted)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
          <Layers size={13} color="var(--color-accent)" /> Campaigns
        </Link>
        <ChevronRight size={13} color="var(--color-text-muted)" />
        <span style={{ fontSize: 13, color: "var(--color-text-secondary)", fontWeight: 500 }}>
          {meta.name || "New Campaign"}
        </span>
      </div>

      {/* Live editable header */}
      <CampaignHeader
        meta={meta}
        onMetaChange={setMeta}
        onSave={handleSave}
        saving={saving}
        saveError={saveError}
      />

      {/* Channel canvas — full width, no sidebar */}
      <div>
        <HeroPlaceholder />

        {CHANNELS.map(ch => {
          const Icon = ch.icon;
          const isLandingPage = ch.key === "landing_page";
          const isInteractive = ["landing_page","youtube","meta","tiktok","pinterest"].includes(ch.key);
          const handleClick = isLandingPage      ? () => setModalOpen(true)
                            : ch.key === "youtube"   ? () => setYtModalOpen(true)
                            : ch.key === "meta"      ? () => setMetaOpen(true)
                            : ch.key === "tiktok"    ? () => setTiktokOpen(true)
                            : ch.key === "pinterest" ? () => setPinterestOpen(true)
                            : undefined;
          return (
            <section key={ch.key} style={{ marginBottom: 48 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(79,179,186,0.08)", border: "1px solid rgba(79,179,186,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={14} color="var(--color-accent)" />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{ch.label}</h2>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{ch.description}</p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", background: "var(--color-surface-2)", border: "1px solid var(--color-border)", padding: "2px 8px", borderRadius: 20 }}>0</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                {Array.from({ length: ch.slots }).map((_, idx) => (
                  <PlaceholderTile key={idx} tall={isLandingPage} interactive={isInteractive} onClick={isInteractive ? handleClick : undefined} />
                ))}
              </div>

              <div style={{ marginTop: 24, height: 1, background: "var(--color-border)", opacity: 0.4 }} />
            </section>
          );
        })}
      </div>

      {/* Modals */}
      {modalOpen     && <LandingPageModal brandId={brandId} brandName={brandName} campaignId={campaignId} onClose={() => setModalOpen(false)}     onSuccess={() => setModalOpen(false)} />}
      {ytModalOpen   && <YouTubeModal     brandId={brandId} brandName={brandName} campaignId={campaignId} onClose={() => setYtModalOpen(false)}   onSuccess={() => setYtModalOpen(false)} />}
      {metaOpen      && <ChannelModal     config={META_CONFIG}   brandId={brandId} brandName={brandName} campaignId={campaignId} onClose={() => setMetaOpen(false)}      onSuccess={() => setMetaOpen(false)} />}
      {tiktokOpen    && <ChannelModal     config={TIKTOK_CONFIG} brandId={brandId} brandName={brandName} campaignId={campaignId} onClose={() => setTiktokOpen(false)}    onSuccess={() => setTiktokOpen(false)} />}
      {pinterestOpen && <PinterestModal   brandId={brandId} brandName={brandName} campaignId={campaignId} onClose={() => setPinterestOpen(false)} onSuccess={() => setPinterestOpen(false)} />}
    </div>
  );
}
